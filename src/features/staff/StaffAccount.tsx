"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate, formatDateTime } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import type { ClearedPeriodView, DutyRowView, StaffAccount as Account, StaffEntryView } from "@/server/services/staff-account.service";
import {
    STAFF_ENTRY_TYPE_LABELS,
    STAFF_PAYMENT_MODE_LABELS,
    STAFF_RECEIVED_MODE_LABELS,
    type StaffReceivedModeValue,
} from "@/server/validators/staff-account";
import { AddStaffEntryDialog } from "@/features/staff/AddStaffEntryDialog";
import { VoidStaffEntryDialog } from "@/features/staff/VoidStaffEntryDialog";
import { ClearSalaryDialog } from "@/features/staff/ClearSalaryDialog";

// DATE columns arrive as midnight UTC, so the first 10 characters are the day.
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const minus = (n: number) => (n < 0 ? "−" : "");
/** Days from half-days, with a sign: 21 -> "10.5", -4 -> "−2". */
const days = (halfDays: number) => {
    const abs = Math.abs(halfDays);
    return minus(halfDays) + (abs % 2 === 0 ? `${abs / 2}` : (abs / 2).toFixed(1));
};
const signedRupees = (n: number) => minus(n) + formatRupees(Math.abs(n));

/** One passbook line: a duty row (settled or to settle) or an entry. */
type PassbookLine = { kind: "duty"; date: Date; row: DutyRowView } | { kind: "entry"; date: Date; entry: StaffEntryView };

/** Duty rows and entries of one block, merged in date order (duty first on the same day). */
function mergeLines(rows: DutyRowView[], entries: StaffEntryView[]): PassbookLine[] {
    return [
        ...rows.map((row) => ({ kind: "duty" as const, date: row.fromDate, row })),
        ...entries.map((entry) => ({ kind: "entry" as const, date: entry.entryDate, entry })),
    ].sort((a, b) => toIso(a.date).localeCompare(toIso(b.date)) || (a.kind === "duty" ? -1 : 1));
}

const CELL = "py-2 pr-3 align-top";
const COLUMNS = 10;

function Status({ settled }: { settled: boolean }) {
    return settled ? (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
            Settled <Check className="w-3.5 h-3.5" />
        </span>
    ) : (
        <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">To settle</span>
    );
}

// The staff account as one continuous passbook (owner's layout): oldest at the
// top. Each clearing is a block of Settled lines closed by a CLEARED line;
// everything not paid yet -- new duty, late or corrected duty (plus or minus),
// entries -- is under To settle at the bottom. Nothing is ever deleted.
export function StaffAccount({ account }: { account: Account }) {
    const { staff, toSettle, cleared, page, totalPages } = account;
    const [dialog, setDialog] = useState<
        { kind: "add" } | { kind: "clear" } | { kind: "void"; entry: StaffEntryView } | null
    >(null);

    const isFirstPage = page === 1;
    const lastClearedIso = toSettle.lastClearedOn ? toIso(toSettle.lastClearedOn) : null;
    // Oldest clearing first, so the passbook reads top to bottom.
    const periods = [...cleared].reverse();

    const renderLine = (line: PassbookLine, settled: boolean) => {
        if (line.kind === "duty") {
            const r = line.row;
            const reversed = r.amount < 0 || r.halfDays < 0;
            return (
                <tr key={r.key} className="border-b border-gray-100">
                    <td className={CELL}>
                        {r.orderCode ? (
                            <Link href={`/orders/${r.orderCode}`} className="font-medium text-gray-900 hover:text-primary">
                                {r.customerName} ({r.orderCode} · {formatRupees(r.staffSalary)})
                            </Link>
                        ) : (
                            <span className="text-gray-600">Another order ({formatRupees(r.staffSalary)})</span>
                        )}
                        <span className="text-xs text-gray-500"> · #{r.contractNumber}</span>
                        {reversed && <p className="text-xs text-amber-700">paid before, no longer worked</p>}
                    </td>
                    <td className={CELL}>{formatDate(r.fromDate)}</td>
                    <td className={CELL}>{formatDate(r.toDate)}</td>
                    <td className={`${CELL} text-right`}>{days(r.halfDays)}</td>
                    <td className={`${CELL} text-right font-semibold ${r.amount < 0 ? "text-amber-700" : ""}`}>
                        {signedRupees(r.amount)}
                    </td>
                    <td className={CELL} colSpan={3} />
                    <td className={CELL}>
                        <Status settled={settled} />
                    </td>
                    <td className={CELL} />
                </tr>
            );
        }

        const e = line.entry;
        const voided = e.voidedAt !== null;
        const strike = voided ? "line-through text-gray-400" : "";
        const isPaid = e.type === "PAID";
        const lateEntry = !settled && lastClearedIso !== null && toIso(e.entryDate) <= lastClearedIso;
        return (
            <tr key={`x-${e.id}`} className="border-b border-gray-100">
                <td className={`${CELL} ${strike}`}>
                    {isPaid ? "" : <span className="font-medium">{STAFF_ENTRY_TYPE_LABELS[e.type]}</span>}
                </td>
                <td className={`${CELL} ${strike}`}>{isPaid ? "" : formatDate(e.entryDate)}</td>
                <td className={CELL} />
                <td className={CELL} />
                <td className={`${CELL} text-right font-semibold ${strike}`}>{isPaid ? "" : signedRupees(e.amount)}</td>
                <td className={`${CELL} text-right font-semibold ${strike}`}>{isPaid ? formatRupees(-e.amount) : ""}</td>
                <td className={`${CELL} ${strike}`}>{isPaid ? formatDate(e.entryDate) : ""}</td>
                <td className={CELL}>
                    <span className={strike}>{e.remarks}</span>
                    {e.mode && (
                        <p className={`text-xs text-gray-500 ${strike}`}>
                            {e.type === "RECEIVED"
                                ? STAFF_RECEIVED_MODE_LABELS[e.mode as StaffReceivedModeValue] ?? STAFF_PAYMENT_MODE_LABELS[e.mode]
                                : STAFF_PAYMENT_MODE_LABELS[e.mode]}
                            {e.accountDetails && ` · ${e.accountDetails}`}
                        </p>
                    )}
                    {lateEntry && <p className="text-xs text-amber-700">added after clearing</p>}
                    {voided && (
                        <p className="text-xs text-red-700">
                            Voided by {e.voidedBy?.name ?? "a removed user"} on {formatDate(e.voidedAt!)}: {e.voidReason}
                        </p>
                    )}
                </td>
                <td className={CELL}>{!voided && <Status settled={settled} />}</td>
                <td className={`${CELL} text-right`}>
                    {/* A write off can be undone only by the Owner (the server checks too). */}
                    {!settled && !voided && (e.type !== "WRITE_OFF" || account.canWriteOff) && (
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setDialog({ kind: "void", entry: e })}>
                            Void
                        </Button>
                    )}
                </td>
            </tr>
        );
    };

    const carriedLine = (carried: number, key: string, settled: boolean) =>
        carried < 0 ? (
            <tr key={key} className="border-b border-gray-100 bg-amber-50/50">
                <td className={CELL} colSpan={4}>
                    <span className="font-medium text-amber-800">Amount from staff (last clearing)</span>
                </td>
                <td className={`${CELL} text-right font-semibold text-amber-800`}>−{formatRupees(-carried)}</td>
                <td className={CELL} colSpan={3} />
                <td className={CELL}>
                    <Status settled={settled} />
                </td>
                <td className={CELL} />
            </tr>
        ) : null;

    const clearedBand = (p: ClearedPeriodView) => (
        <tr key={`c-${p.id}`} className="bg-gray-100">
            <td colSpan={COLUMNS} className="px-3 py-2 text-sm font-semibold text-gray-700">
                ══ CLEARED {formatDate(p.clearedOn)} · earned {signedRupees(p.earned + p.extras)} · paid{" "}
                {formatRupees(p.paid + Math.max(0, p.finalAmount))}
                {p.recovered !== 0 && ` · received / written off ${formatRupees(p.recovered)}`}
                {p.finalAmount < 0 ? ` · amount from staff ${formatRupees(-p.finalAmount)}` : " · balance ₹0"}
                <span className="font-normal text-gray-500">
                    {" "}
                    — by {p.clearedBy ?? "a removed user"}, {formatDateTime(p.createdAt)}
                </span>
            </td>
        </tr>
    );

    // Something new since the last clearing -- only then can it be cleared
    // (an owed amount alone just waits for the next earning).
    const hasNew = toSettle.rows.length > 0 || toSettle.entries.length > 0;
    const hasToSettle = hasNew || toSettle.carried !== 0;
    const toSettleDays = toSettle.rows.reduce((sum, r) => sum + r.halfDays, 0);

    return (
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-md overflow-hidden">
            {/* ===== Heading: staff name · place ===== */}
            <div className="bg-linear-to-br from-pink-100 via-pink-50 to-purple-100 border-b border-gray-200 px-4 py-4 sm:px-8 sm:py-5">
                <Link href={`/staff/${staff.id}`} className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-primary">
                    <ArrowLeft className="w-4 h-4" />
                    Back to staff
                </Link>
                <h1 className="flex items-center gap-2 text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                    <Wallet className="w-7 h-7 text-primary" />
                    {staff.name} · {staff.place}
                </h1>
            </div>

            <div className="px-4 py-4 sm:px-8 sm:py-6 space-y-4">
                {page < totalPages && (
                    <Link href={`?page=${page + 1}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                        <ChevronLeft className="w-4 h-4" />
                        View older clearings
                    </Link>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-sm tabular-nums">
                        <thead>
                            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                                <th className="py-2 pr-3">Customer (order · staff salary)</th>
                                <th className="py-2 pr-3">Start</th>
                                <th className="py-2 pr-3">End</th>
                                <th className="py-2 pr-3 text-right">Days</th>
                                <th className="py-2 pr-3 text-right">Earned</th>
                                <th className="py-2 pr-3 text-right">Paid</th>
                                <th className="py-2 pr-3">Date of pay</th>
                                <th className="py-2 pr-3">Remarks</th>
                                <th className="py-2 pr-3">Status</th>
                                <th className="py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {periods.map((p) => (
                                <Fragment key={`p-${p.id}`}>
                                    {carriedLine(p.carried, `carried-${p.id}`, true)}
                                    {mergeLines(p.rows, p.entries).map((line) => renderLine(line, true))}
                                    {clearedBand(p)}
                                </Fragment>
                            ))}

                            {isFirstPage && (
                                <>
                                    <tr>
                                        <td colSpan={COLUMNS} className="pt-5 pb-2 text-xs font-bold uppercase tracking-wider text-amber-800">
                                            To settle
                                        </td>
                                    </tr>
                                    {carriedLine(toSettle.carried, "carried-open", false)}
                                    {mergeLines(toSettle.rows, toSettle.entries).map((line) => renderLine(line, false))}
                                    {!hasToSettle && (
                                        <tr>
                                            <td colSpan={COLUMNS} className="py-4 text-center text-gray-500">
                                                Nothing to settle — everything is paid.
                                            </td>
                                        </tr>
                                    )}
                                    <tr className="border-t-2 border-gray-300 font-bold">
                                        <td className={CELL} colSpan={3}>
                                            Total to settle
                                        </td>
                                        <td className={`${CELL} text-right`}>{days(toSettleDays)}</td>
                                        <td className={`${CELL} text-right`}>{signedRupees(toSettle.carried + toSettle.earned + toSettle.extras + toSettle.recovered)}</td>
                                        <td className={`${CELL} text-right`}>{formatRupees(toSettle.paid)}</td>
                                        <td className={CELL} colSpan={4} />
                                    </tr>
                                </>
                            )}
                        </tbody>
                    </table>
                </div>

                {isFirstPage ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4">
                        <p className="text-lg font-bold text-gray-900">
                            {toSettle.balance >= 0 ? "Balance to pay: " : "Advance given – staff has to return: "}
                            <span className={toSettle.balance < 0 ? "text-amber-700" : ""}>{formatRupees(Math.abs(toSettle.balance))}</span>
                        </p>
                        <div className="flex flex-wrap gap-2">
                            {/* title = the browser's own tooltip, shown on hover */}
                            <Button
                                variant="secondary"
                                onClick={() => setDialog({ kind: "add" })}
                                title="To enter all advances, paid salaries, etc."
                            >
                                <Plus className="w-4 h-4" />
                                Add entry
                            </Button>
                            <Button
                                onClick={() => setDialog({ kind: "clear" })}
                                disabled={!hasNew}
                                title={
                                    hasNew
                                        ? "Use this only when you need to clear the salary until now."
                                        : "Nothing new to settle since the last clearing"
                                }
                            >
                                Clear the salary now
                            </Button>
                        </div>
                    </div>
                ) : (
                    <Link href={`?page=${page - 1}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
                        Newer
                        <ChevronRight className="w-4 h-4" />
                    </Link>
                )}
            </div>

            {dialog?.kind === "add" && (
                <AddStaffEntryDialog
                    staffId={staff.id}
                    owes={Math.max(0, -toSettle.balance)}
                    canWriteOff={account.canWriteOff}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.kind === "void" && (
                <VoidStaffEntryDialog staffId={staff.id} entry={dialog.entry} onClose={() => setDialog(null)} />
            )}
            {dialog?.kind === "clear" && (
                <ClearSalaryDialog
                    staffId={staff.id}
                    staffName={staff.name}
                    totals={{
                        carried: toSettle.carried,
                        earned: toSettle.earned,
                        extras: toSettle.extras,
                        recovered: toSettle.recovered,
                        paid: toSettle.paid,
                        balance: toSettle.balance,
                    }}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}
