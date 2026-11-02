"use client";

import { useState, type ReactNode } from "react";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate, formatDateTime } from "@/lib/date";
import type { OrderDetails as Order } from "@/server/services/order.service";
import type { PaymentModeValue } from "@/server/validators/payment";
import { SectionCard } from "@/features/order/SectionCard";
import { formatRupees } from "@/lib/money";
import { PAYMENT_STATUS_STYLES } from "@/features/order/paymentStatus";
import { ContractMoneyDialog, type ContractMoneyTarget } from "@/features/order/ContractMoneyDialog";
import { DeleteContractDialog } from "@/features/order/DeleteContractDialog";
import { AddPaymentDialog } from "@/features/order/AddPaymentDialog";
import { ContractPaymentsDialog } from "@/features/order/ContractPaymentsDialog";
import { VoidPaymentDialog } from "@/features/order/VoidPaymentDialog";

interface ContractsSectionProps {
    order: Order;
    /** The rows to show, oldest first -- all of them, or one page (see latestPage). */
    contracts: Order["contracts"];
    /** Per contract id: days not counted; null = no dates yet. */
    leaveDays: Record<number, number | null>;
    /** null while the latest contract's end is still pending (or no contract yet). */
    nextContract: { opensOn: Date; defaultRate: number; defaultStaffSalary: number } | null;
    /** Kerala's today, yyyy-mm-dd. */
    today: string;
    /** Under the table: "View all" link, or page buttons. */
    footer?: ReactNode;
}

// Which dialog is open -- only ever one at a time. Contracts are looked up by
// id from the (refreshed) order, so the payment history shows a new or voided
// payment straight after saving. `backTo` = reopen the history afterwards.
type OpenDialog =
    | { kind: "money"; target: ContractMoneyTarget; rate: number; staffSalary: number; needsRateCheck?: boolean }
    | { kind: "deleteContract"; contractId: number; contractNumber: number }
    | { kind: "payments"; contractId: number }
    | { kind: "addPayment"; contractId: number; backTo: boolean }
    | {
          kind: "voidPayment";
          contractId: number;
          payment: { id: number; amount: number; paidOn: Date; mode: PaymentModeValue };
      }
    | null;

// DATE columns arrive as midnight UTC, so the first 10 characters are the day.
const toIso = (date: Date) => date.toISOString().slice(0, 10);

// The contract table with all its actions. Used by the order page (latest 5)
// and the "all contracts" page (25 per page) -- one component, so every
// button works the same on both.
export function ContractsSection({ order, contracts, leaveDays, nextContract, today, footer }: ContractsSectionProps) {
    const [dialog, setDialog] = useState<OpenDialog>(null);

    const isEnded = order.status === "ENDED";
    // The order's real latest contract -- not the last row of this page.
    const latest = order.contracts.at(-1);
    const canStartNext = !isEnded && !!nextContract && today >= toIso(nextContract.opensOn);
    const dialogContract =
        dialog && "contractId" in dialog ? order.contracts.find((c) => c.id === dialog.contractId) : undefined;

    return (
        <SectionCard
            title="Contracts"
            action={
                canStartNext && latest && nextContract ? (
                    <Button
                        size="sm"
                        onClick={() =>
                            setDialog({
                                kind: "money",
                                target: { kind: "next", orderId: order.id, nextNumber: latest.contractNumber + 1 },
                                rate: nextContract.defaultRate,
                                staffSalary: nextContract.defaultStaffSalary,
                            })
                        }
                    >
                        <FileText className="w-4 h-4" />
                        Start next contract
                    </Button>
                ) : undefined
            }
        >
            {order.contracts.length === 0 ? (
                <p className="text-sm text-gray-500">Care hasn&apos;t started yet. Use “Start care” below.</p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm tabular-nums">
                        <thead>
                            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                                <th className="py-2 pr-4">#</th>
                                <th className="py-2 pr-4">Start</th>
                                {/* An end in the future is only expected: leave can still move it. */}
                                <th className="py-2 pr-4">Expected / End</th>
                                <th className="py-2 pr-4" title="Days in this contract with no paid staff — not counted">
                                    Leave days
                                </th>
                                <th className="py-2 pr-4">Served</th>
                                <th className="py-2 pr-4 text-right">Rate</th>
                                {/* Staff salary lives in the ✏️ dialog; this table is the customer side. */}
                                <th className="py-2 pr-4">Paid status</th>
                                <th className="py-2 pr-4">Paid on</th>
                                <th className="py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            {contracts.map((c) => (
                                <tr key={c.id} className="border-b border-gray-100 last:border-0">
                                    <td className="py-2 pr-4 font-semibold">#{c.contractNumber}</td>
                                    <td className="py-2 pr-4">{c.startDate ? formatDate(c.startDate) : "—"}</td>
                                    <td className="py-2 pr-4">
                                        {c.endDate ? (
                                            formatDate(c.endDate)
                                        ) : (
                                            <span className="text-amber-700" title="Depends on the next staff">
                                                pending
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-2 pr-4">
                                        {leaveDays[c.id] == null ? (
                                            "—"
                                        ) : leaveDays[c.id]! > 0 ? (
                                            <span className="font-semibold text-amber-700">{leaveDays[c.id]}</span>
                                        ) : (
                                            0
                                        )}
                                    </td>
                                    <td className="py-2 pr-4">{c.servedDays}/28</td>
                                    <td
                                        className="py-2 pr-4 text-right"
                                        // Who set or confirmed this rate, on hover.
                                        title={
                                            c.rateCheckedAt
                                                ? `Rate checked by ${c.rateCheckedBy?.name ?? "a removed user"} on ${formatDateTime(c.rateCheckedAt)}`
                                                : undefined
                                        }
                                    >
                                        {formatRupees(c.rate)}
                                    </td>
                                    <td className="py-2 pr-4">
                                        {/* Click = this contract's payment history (add / void there). */}
                                        <button
                                            type="button"
                                            onClick={() => setDialog({ kind: "payments", contractId: c.id })}
                                            title={`${formatRupees(c.paidAmount)} paid · ${formatRupees(Math.max(0, c.rate - c.paidAmount))} due`}
                                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold hover:ring-2 hover:ring-gray-300 ${PAYMENT_STATUS_STYLES[c.paymentStatus].className}`}
                                        >
                                            {PAYMENT_STATUS_STYLES[c.paymentStatus].label}
                                        </button>
                                    </td>
                                    <td className="py-2 pr-4">{c.fullyPaidOn ? formatDate(c.fullyPaidOn) : "—"}</td>
                                    <td className="py-2 text-right whitespace-nowrap">
                                        {!isEnded && c.paymentStatus !== "FULLY_PAID" && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => setDialog({ kind: "addPayment", contractId: c.id, backTo: false })}
                                            >
                                                <Plus className="w-4 h-4" />
                                                Payment
                                            </Button>
                                        )}
                                        {/* Started by the nightly job with a copied rate, not yet checked by a person. */}
                                        {!isEnded && c.autoStarted && !c.rateCheckedAt && (
                                            <span className="mr-1 inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                                Auto-started · check rate
                                            </span>
                                        )}
                                        {!isEnded && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                aria-label={`Edit contract #${c.contractNumber}`}
                                                onClick={() =>
                                                    setDialog({
                                                        kind: "money",
                                                        target: { kind: "edit", contractId: c.id, contractNumber: c.contractNumber },
                                                        rate: c.rate,
                                                        staffSalary: c.staffSalary,
                                                        needsRateCheck: c.autoStarted && !c.rateCheckedAt,
                                                    })
                                                }
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                        )}
                                        {/* Only a contract started by mistake: latest, not #1, nothing served. */}
                                        {!isEnded && c.id === latest?.id && c.contractNumber > 1 && c.servedDays === 0 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                aria-label={`Delete contract #${c.contractNumber}`}
                                                className="text-red-600"
                                                onClick={() =>
                                                    setDialog({ kind: "deleteContract", contractId: c.id, contractNumber: c.contractNumber })
                                                }
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {nextContract && !canStartNext && !isEnded && (
                        <p className="mt-3 text-xs text-gray-500">
                            The next contract can be started from {formatDate(nextContract.opensOn)}.
                        </p>
                    )}
                    {footer}
                </div>
            )}

            {/* ===== Dialogs (one at a time) ===== */}
            {dialog?.kind === "money" && (
                <ContractMoneyDialog
                    target={dialog.target}
                    initialRate={dialog.rate}
                    initialStaffSalary={dialog.staffSalary}
                    needsRateCheck={dialog.needsRateCheck}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.kind === "deleteContract" && (
                <DeleteContractDialog
                    contractId={dialog.contractId}
                    contractNumber={dialog.contractNumber}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.kind === "payments" && dialogContract && (
                <ContractPaymentsDialog
                    contract={dialogContract}
                    canChange={!isEnded}
                    onAdd={() => setDialog({ kind: "addPayment", contractId: dialogContract.id, backTo: true })}
                    onVoid={(p) => setDialog({ kind: "voidPayment", contractId: dialogContract.id, payment: p })}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.kind === "addPayment" && dialogContract && (
                <AddPaymentDialog
                    contract={dialogContract}
                    // All payments on the order, from every contract -- for the double-entry check.
                    orderPayments={order.contracts.flatMap((c) =>
                        c.payments.map((p) => ({ ...p, contractNumber: c.contractNumber })),
                    )}
                    today={today}
                    onClose={() => setDialog(dialog.backTo ? { kind: "payments", contractId: dialogContract.id } : null)}
                />
            )}
            {dialog?.kind === "voidPayment" && (
                <VoidPaymentDialog
                    payment={dialog.payment}
                    onClose={() => setDialog({ kind: "payments", contractId: dialog.contractId })}
                />
            )}
        </SectionCard>
    );
}
