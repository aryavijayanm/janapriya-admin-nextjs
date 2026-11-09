"use client";

import type { ReactNode } from "react";
import { Plus, Undo2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import { PAYMENT_STATUS_STYLES } from "@/features/order/paymentStatus";
import { PAYMENT_MODE_LABELS } from "@/server/validators/payment";
import { balanceDue, contractAmountDue, refundDue } from "@/server/domain/payments";
import type { OrderDetails } from "@/server/services/order.service";

type ContractWithPayments = OrderDetails["contracts"][number];
type ContractPayment = ContractWithPayments["payments"][number];
type ContractRefund = ContractWithPayments["refunds"][number];

interface ContractPaymentsDialogProps {
    contract: ContractWithPayments;
    /** False = history only, no adding or voiding. */
    canChange: boolean;
    onAdd: () => void;
    onVoid: (payment: ContractPayment) => void;
    onAddRefund: () => void;
    onVoidRefund: (refund: ContractRefund) => void;
    onClose: () => void;
}

/** One money row (payment or refund): crossed out with who/when/why when voided. */
function MoneyRow({
    date,
    amount,
    how,
    account,
    note,
    recordedBy,
    voided,
    canVoid,
    onVoid,
}: {
    date: Date;
    amount: number;
    how: string;
    account: string | null;
    note?: string;
    recordedBy: string | null;
    voided: { by: string | null; on: Date; reason: string | null } | null;
    canVoid: boolean;
    onVoid: () => void;
}) {
    const strike = voided ? "line-through text-gray-400" : "";
    return (
        <tr className="border-b border-gray-100 last:border-0 align-top">
            <td className={`py-2 pr-4 ${strike}`}>{formatDate(date)}</td>
            <td className={`py-2 pr-4 text-right font-semibold ${strike}`}>{formatRupees(amount)}</td>
            <td className={`py-2 pr-4 ${strike}`}>
                {how}
                {note && <p className="text-xs text-gray-500">{note}</p>}
            </td>
            <td className={`py-2 pr-4 ${strike}`}>{account ?? "—"}</td>
            <td className="py-2 pr-4 text-gray-600">
                {recordedBy ?? "—"}
                {voided && (
                    <p className="mt-0.5 text-xs text-red-700">
                        Voided by {voided.by ?? "a removed user"} on {formatDate(voided.on)}: {voided.reason}
                    </p>
                )}
            </td>
            <td className="py-2 text-right">
                {canVoid && !voided && (
                    <Button variant="ghost" size="sm" className="text-red-600" onClick={onVoid}>
                        Void
                    </Button>
                )}
            </td>
        </tr>
    );
}

function MoneyTable({ dateLabel, children }: { dateLabel: string; children: ReactNode }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
                <thead>
                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                        <th className="py-2 pr-4">{dateLabel}</th>
                        <th className="py-2 pr-4 text-right">Amount</th>
                        <th className="py-2 pr-4">How</th>
                        <th className="py-2 pr-4">Account</th>
                        <th className="py-2 pr-4">Recorded by</th>
                        <th className="py-2" />
                    </tr>
                </thead>
                <tbody>{children}</tbody>
            </table>
        </div>
    );
}

// One contract's money history -- opened by clicking its Paid status pill.
// Newest first. Voided rows stay, crossed out, with who/when/why. After End
// order it also shows the charge for the days served and the refunds.
export function ContractPaymentsDialog({
    contract,
    canChange,
    onAdd,
    onVoid,
    onAddRefund,
    onVoidRefund,
    onClose,
}: ContractPaymentsDialogProps) {
    const status = PAYMENT_STATUS_STYLES[contract.paymentStatus];
    const ended = contract.charge !== null;
    const due = balanceDue(contractAmountDue(contract), contract.paidAmount);
    const toRefund = refundDue(contract);

    return (
        <Modal isOpen onClose={onClose} title={`Payments · contract #${contract.contractNumber}`} size="lg">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-gray-50 px-4 py-3 text-sm tabular-nums">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                    <span>Rate <span className="font-semibold">{formatRupees(contract.rate)}</span></span>
                    {ended && (
                        <span title={`Rate ÷ 28 × ${contract.servedDays} days served`}>
                            Charge <span className="font-semibold">{formatRupees(contract.charge!)}</span>
                        </span>
                    )}
                    <span>Paid <span className="font-semibold">{formatRupees(contract.paidAmount)}</span></span>
                    <span>Due <span className="font-semibold text-red-700">{formatRupees(due)}</span></span>
                    {ended && contract.refundedAmount > 0 && (
                        <span>Refunded <span className="font-semibold">{formatRupees(contract.refundedAmount)}</span></span>
                    )}
                    {toRefund > 0 && (
                        <span>To refund <span className="font-semibold text-amber-700">{formatRupees(toRefund)}</span></span>
                    )}
                    {contract.fullyPaidOn && <span>Fully paid on {formatDate(contract.fullyPaidOn)}</span>}
                </div>

                {contract.payments.length === 0 ? (
                    <p className="text-sm text-gray-500">No payments recorded yet.</p>
                ) : (
                    <MoneyTable dateLabel="Paid on">
                        {contract.payments.map((p) => (
                            <MoneyRow
                                key={p.id}
                                date={p.paidOn}
                                amount={p.amount}
                                how={PAYMENT_MODE_LABELS[p.mode]}
                                account={p.accountDetails}
                                recordedBy={p.recordedBy?.name ?? null}
                                voided={p.voidedAt ? { by: p.voidedBy?.name ?? null, on: p.voidedAt, reason: p.voidReason } : null}
                                canVoid={canChange}
                                onVoid={() => onVoid(p)}
                            />
                        ))}
                    </MoneyTable>
                )}

                {contract.refunds.length > 0 && (
                    <div>
                        <h3 className="mb-1 text-sm font-semibold text-gray-700">Refunds (money given back)</h3>
                        <MoneyTable dateLabel="Refunded on">
                            {contract.refunds.map((r) => (
                                <MoneyRow
                                    key={r.id}
                                    date={r.refundedOn}
                                    amount={r.amount}
                                    how={PAYMENT_MODE_LABELS[r.mode]}
                                    note={r.remarks}
                                    account={r.accountDetails}
                                    recordedBy={r.recordedBy?.name ?? null}
                                    voided={r.voidedAt ? { by: r.voidedBy?.name ?? null, on: r.voidedAt, reason: r.voidReason } : null}
                                    canVoid={canChange}
                                    onVoid={() => onVoidRefund(r)}
                                />
                            ))}
                        </MoneyTable>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
                    {canChange && toRefund > 0 && (
                        <Button variant="secondary" onClick={onAddRefund}>
                            <Undo2 className="w-4 h-4" />
                            Record refund
                        </Button>
                    )}
                    {canChange && due > 0 && (
                        <Button onClick={onAdd}>
                            <Plus className="w-4 h-4" />
                            Add payment
                        </Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}
