"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { RupeesInput } from "@/features/order/dutyFields";
import { formatRupees } from "@/lib/money";
import { recordRefundAction } from "@/features/order/order.actions";
import { useServerAction } from "@/hooks/useServerAction";
import { refundDue } from "@/server/domain/payments";
import { PAYMENT_MODE_LABELS, REFUND_MODES, refundSchema, type RefundModeValue } from "@/server/validators/payment";

interface RecordRefundDialogProps {
    contract: { id: number; contractNumber: number; charge: number | null; paidAmount: number; refundedAmount: number };
    /** Kerala's today, yyyy-mm-dd -- the latest allowed refund date. */
    today: string;
    onClose: () => void;
}

// Records money given BACK to the customer after End order. The amount starts
// as the refund due; date and "how" start empty and must be chosen (same
// reason as payments: a default gets saved when someone forgets to change it).
// Never more than the refund due -- checked here and, for real, on the server.
export function RecordRefundDialog({ contract, today, onClose }: RecordRefundDialogProps) {
    const due = refundDue(contract);
    const [amount, setAmount] = useState(due > 0 ? due : Number.NaN);
    const [refundedOn, setRefundedOn] = useState("");
    const [mode, setMode] = useState<RefundModeValue | "">("");
    const [accountDetails, setAccountDetails] = useState("");
    const [remarks, setRemarks] = useState("");
    const { run, isPending, error, setError } = useServerAction();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = { amount, refundedOn, mode, accountDetails, remarks };
        const check = refundSchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }
        if (amount > due) {
            setError(`Only ${formatRupees(due)} is to be refunded on #${contract.contractNumber}. Please check the amount.`);
            return;
        }
        const result = await run(() => recordRefundAction(contract.id, payload));
        if (result.ok) onClose();
    };

    return (
        <Modal isOpen onClose={() => !isPending && onClose()} title={`Record refund · contract #${contract.contractNumber}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm tabular-nums">
                    <div>
                        <p className="text-xs text-gray-500">Paid</p>
                        <p className="font-semibold">{formatRupees(contract.paidAmount)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Charge for days served</p>
                        <p className="font-semibold">{formatRupees(contract.charge ?? 0)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">To refund</p>
                        <p className="font-semibold text-amber-700">{formatRupees(due)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Amount" htmlFor="refund-amount">
                        <RupeesInput id="refund-amount" value={amount} onChange={setAmount} />
                    </FormField>
                    <FormField label="Refunded on" htmlFor="refund-date">
                        <Input id="refund-date" type="date" max={today} value={refundedOn} onChange={(e) => setRefundedOn(e.target.value)} />
                    </FormField>
                </div>

                <FormField label="How it was refunded" htmlFor="refund-mode">
                    <Select id="refund-mode" value={mode} onChange={(e) => setMode(e.target.value as RefundModeValue)}>
                        <option value="" disabled>
                            Select…
                        </option>
                        {REFUND_MODES.map((m) => (
                            <option key={m} value={m}>
                                {PAYMENT_MODE_LABELS[m]}
                            </option>
                        ))}
                    </Select>
                </FormField>

                <FormField label="Remarks" htmlFor="refund-remarks">
                    <Input
                        id="refund-remarks"
                        maxLength={200}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="e.g. Unused days after stopping care"
                    />
                </FormField>

                <FormField label="Account details (optional)" htmlFor="refund-account">
                    <Input
                        id="refund-account"
                        maxLength={200}
                        value={accountDetails}
                        onChange={(e) => setAccountDetails(e.target.value)}
                        placeholder="e.g. Rama SBI"
                    />
                </FormField>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isPending}>
                        Save refund
                    </Button>
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
