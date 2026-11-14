"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { usePagination } from "@/hooks/usePagination";
import { useServerAction } from "@/hooks/useServerAction";
import { formatDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import type { PaginatedResult } from "@/server/db/paginate";
import type { AccountBookRow, AccountDay } from "@/server/services/account-book.service";
import { deleteAccountEntryAction } from "@/features/accounts/accounts.actions";
import { AccountEntryDialog } from "@/features/accounts/AccountEntryDialog";
import { AccountDayCard } from "@/features/accounts/AccountDayCard";
import { ExportAccountsCard } from "@/features/accounts/ExportAccountsCard";
import { accountColumns } from "@/features/accounts/accountColumns";
import { ACCOUNT_DIRECTION_LABELS } from "@/server/validators/account-book";

interface AccountsBookProps {
    /** The day card's day and today, yyyy-mm-dd (from the server, so both sides agree). */
    day: string;
    today: string;
    dayData: AccountDay;
    /** This month so far, one page. */
    monthRows: AccountBookRow[];
    monthPagination: PaginatedResult<AccountBookRow>["pagination"];
    /** Owner: the Excel download card. */
    canExport: boolean;
}

// The accounts book page, as cards:
//   1. ACCOUNTS BOOK + "Add entry"
//   2. one day (‹ › to move), with its In / Out / Net
//   3. Owner only: download Excel
//   4. this month so far (newest first, 50 a page)
// Typed entries have Edit / Delete icons in both tables; rows fetched from
// payments, refunds and staff salary are read-only here -- they're changed
// where they were entered, and the book follows by itself.
export function AccountsBook({ day, today, dayData, monthRows, monthPagination, canExport }: AccountsBookProps) {
    const { setPage } = usePagination();
    // Which popup is open: add (no entry) / edit (an entry), or nothing.
    const [editing, setEditing] = useState<{ entry?: AccountBookRow } | null>(null);
    const [deleting, setDeleting] = useState<AccountBookRow | null>(null);
    const removal = useServerAction();

    const handleDelete = async () => {
        if (!deleting) return;
        await removal.run(() => deleteAccountEntryAction(deleting.id));
        // Closed either way, so a refusal message shows on the page, not behind the popup.
        setDeleting(null);
    };

    const handlers = { onEdit: (row: AccountBookRow) => setEditing({ entry: row }), onDelete: setDeleting };
    const todayText = formatDate(today);

    return (
        <div className="space-y-6">
            {/* Card 1: title + Add entry, same row. */}
            <section className="bg-white rounded-lg shadow-md p-4 sm:p-6 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-gray-800">ACCOUNTS BOOK</h2>
                <Button onClick={() => setEditing({})}>
                    <Plus className="w-4 h-4" />
                    Add entry
                </Button>
            </section>

            {removal.error && <Alert variant="error">{removal.error}</Alert>}

            {/* Card 2: one day. */}
            <AccountDayCard day={day} today={today} data={dayData} columns={accountColumns({ showDate: false, ...handlers })} />

            {/* Card 3: Owner only. */}
            {canExport && <ExportAccountsCard today={todayText} />}

            {/* Card 4: this month so far. */}
            <section className="bg-white rounded-lg shadow-md p-4 sm:p-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4">
                    This month: 01{todayText.slice(2)} to {todayText}
                </h3>
                <DataTable
                    columns={accountColumns({ showDate: true, ...handlers })}
                    data={monthRows}
                    getRowKey={(row) => `${row.source}-${row.id}`}
                    isLoading={false}
                    emptyMessage="Nothing this month yet."
                    currentPage={monthPagination.page}
                    totalPages={monthPagination.totalPages}
                    onPageChange={setPage}
                />
            </section>

            {editing && <AccountEntryDialog entry={editing.entry} today={todayText} onClose={() => setEditing(null)} />}

            <Modal isOpen={deleting !== null} onClose={() => !removal.isPending && setDeleting(null)} title="Delete entry" size="sm">
                {deleting && (
                    <p className="text-sm text-gray-600">
                        Delete this entry?{" "}
                        <span className="font-semibold">
                            {formatDate(deleting.date)} · {ACCOUNT_DIRECTION_LABELS[deleting.direction]} ·{" "}
                            {formatRupees(deleting.amount)} · {deleting.remarks}
                        </span>
                    </p>
                )}
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={() => setDeleting(null)} disabled={removal.isPending}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDelete} isLoading={removal.isPending}>
                        OK
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
