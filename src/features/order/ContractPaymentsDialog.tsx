"use client";

import { Plus } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import { PAYMENT_STATUS_STYLES } from "@/features/order/paymentStatus";
import { PAYMENT_MODE_LABELS } from "@/server/validators/payment";
import type { OrderDetails } from "@/server/services/order.service";

type ContractWithPayments = OrderDetails["contracts"][number];
type ContractPayment = ContractWithPayments["payments"][number];

interface ContractPaymentsDialogProps {
    contract: ContractWithPayments;
    /** False on an ended order: history only, no adding or voiding. */
    canChange: boolean;
    onAdd: () => void;
    onVoid: (payment: ContractPayment) => void;
    onClose: () => void;
}

// One contract's payment history -- opened by clicking its Paid status pill.
// Newest first. Voided payments stay, crossed out, with who/when/why.
export function ContractPaymentsDialog({ contract, canChange, onAdd, onVoid, onClose }: ContractPaymentsDialogProps) {
    const status = PAYMENT_STATUS_STYLES[contract.paymentStatus];
    const due = Math.max(0, contract.rate - contract.paidAmount);

    return (
        <Modal isOpen onClose={onClose} title={`Payments · contract #${contract.contractNumber}`} size="lg">
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-gray-50 px-4 py-3 text-sm tabular-nums">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
                    <span>Rate <span className="font-semibold">{formatRupees(contract.rate)}</span></span>
                    <span>Paid <span className="font-semibold">{formatRupees(contract.paidAmount)}</span></span>
                    <span>Due <span className="font-semibold text-red-700">{formatRupees(due)}</span></span>
                    {contract.fullyPaidOn && <span>Fully paid on {formatDate(contract.fullyPaidOn)}</span>}
                </div>

                {contract.payments.length === 0 ? (
                    <p className="text-sm text-gray-500">No payments recorded yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm tabular-nums">
                            <thead>
                                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                                    <th className="py-2 pr-4">Paid on</th>
                                    <th className="py-2 pr-4 text-right">Amount</th>
                                    <th className="py-2 pr-4">How</th>
                                    <th className="py-2 pr-4">Account</th>
                                    <th className="py-2 pr-4">Recorded by</th>
                                    <th className="py-2" />
                                </tr>
                            </thead>
                            <tbody>
                                {contract.payments.map((p) => {
                                    const voided = p.voidedAt !== null;
                                    return (
                                        <tr key={p.id} className="border-b border-gray-100 last:border-0 align-top">
                                            <td className={`py-2 pr-4 ${voided ? "line-through text-gray-400" : ""}`}>
                                                {formatDate(p.paidOn)}
                                            </td>
                                            <td className={`py-2 pr-4 text-right font-semibold ${voided ? "line-through text-gray-400" : ""}`}>
                                                {formatRupees(p.amount)}
                                            </td>
                                            <td className={`py-2 pr-4 ${voided ? "line-through text-gray-400" : ""}`}>
                                                {PAYMENT_MODE_LABELS[p.mode]}
                                            </td>
                                            <td className={`py-2 pr-4 ${voided ? "line-through text-gray-400" : ""}`}>
                                                {p.accountDetails ?? "—"}
                                            </td>
                                            <td className="py-2 pr-4 text-gray-600">
                                                {p.recordedBy?.name ?? "—"}
                                                {voided && (
                                                    <p className="mt-0.5 text-xs text-red-700">
                                                        Voided by {p.voidedBy?.name ?? "a removed user"} on{" "}
                                                        {formatDate(p.voidedAt!)}: {p.voidReason}
                                                    </p>
                                                )}
                                            </td>
                                            <td className="py-2 text-right">
                                                {canChange && !voided && (
                                                    <Button variant="ghost" size="sm" className="text-red-600" onClick={() => onVoid(p)}>
                                                        Void
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        Close
                    </Button>
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
