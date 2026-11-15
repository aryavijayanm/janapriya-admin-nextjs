"use client";

import { Table, type TableColumn } from "@/components/ui/Table";
import { formatRupees } from "@/lib/money";
import type { AccountBookRow, AccountDay } from "@/server/services/account-book.service";

function Total({ label, amount, className }: { label: string; amount: string; className: string }) {
    return (
        <div className="rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${className}`}>{amount}</p>
        </div>
    );
}

// One day's money: Receipts, Payments and Net (voided rows don't count),
// then every row of the day (voided ones crossed out). Shared by the
// accounts book's day card and the activities page's Money tab -- the
// columns decide whether Edit / Delete icons show.
export function AccountDaySummary({ data, columns }: { data: AccountDay; columns: TableColumn<AccountBookRow>[] }) {
    const net = data.totalIn - data.totalOut;
    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <Total label="Receipts" amount={formatRupees(data.totalIn)} className="text-green-700" />
                <Total label="Payments" amount={formatRupees(data.totalOut)} className="text-red-700" />
                <Total
                    label="Net (Receipts − Payments)"
                    amount={`${net < 0 ? "−" : ""}${formatRupees(Math.abs(net))}`}
                    className={net < 0 ? "text-red-700" : "text-gray-900"}
                />
            </div>
            <Table
                columns={columns}
                data={data.rows}
                getRowKey={(row) => `${row.source}-${row.id}`}
                emptyMessage="No money in or out on this day."
            />
        </>
    );
}
