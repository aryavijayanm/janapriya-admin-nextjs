"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatDate } from "@/lib/date";
import { RupeesInput } from "@/features/order/dutyFields";
import { formatRupees } from "@/lib/money";
import { recordPaymentAction } from "@/features/order/order.actions";
import { useServerAction } from "@/hooks/useServerAction";
import { PAYMENT_MODES, PAYMENT_MODE_LABELS, paymentSchema, type PaymentModeValue } from "@/server/validators/payment";
import { balanceDue, contractAmountDue } from "@/server/domain/payments";

/** One payment already recorded on this order (any contract), for the double-entry check. */
export interface ExistingOrderPayment {
    id: number;
    contractNumber: number;
    amount: number;
    paidOn: Date;
    mode: PaymentModeValue;
    voidedAt: Date | null;
    recordedBy: { name: string } | null;
}

interface AddPaymentDialogProps {
    contract: { id: number; contractNumber: number; rate: number; charge: number | null; paidAmount: number };
    /** Every payment on the order -- already loaded on the page, so the check costs no call. */
    orderPayments: ExistingOrderPayment[];
    /** Kerala's today, yyyy-mm-dd -- the latest allowed paid-on date. */
    today: string;
    onClose: () => void;
}

// DATE columns arrive as midnight UTC, so the first 10 characters are the day.
const toIso = (date: Date) => date.toISOString().slice(0, 10);

// Records one payment against one contract. The amount starts as the
// balance due (the usual case); the paid-on date and mode start EMPTY and
// must be chosen -- payments are often recorded days later, and a default
// would be saved whenever someone forgot to change it.
//
// Double-entry check: if this order already has a payment with the SAME
// paid-on date and the SAME amount, ask before saving. A normal split
// (different amounts on two contracts) saves without interruption. Done here
// in the browser from data the page already has; the server still enforces
// the real rules (balance, dates).
export function AddPaymentDialog({ contract, orderPayments, today, onClose }: AddPaymentDialogProps) {
    // The charge for the days served once the order ended, else the rate -- same rule as the server.
    const amountDue = contractAmountDue(contract);
    const due = balanceDue(amountDue, contract.paidAmount);
    const [amount, setAmount] = useState(due > 0 ? due : Number.NaN);
    const [paidOn, setPaidOn] = useState("");
    const [mode, setMode] = useState<PaymentModeValue | "">("");
    const [accountDetails, setAccountDetails] = useState("");
    const { run, isPending: isSubmitting, error, setError } = useServerAction();
    // Look-alike payments found; null = no warning showing.
    const [lookAlikes, setLookAlikes] = useState<ExistingOrderPayment[] | null>(null);

    const save = async () => {
        const result = await run(() => recordPaymentAction(contract.id, { amount, paidOn, mode, accountDetails }));
        if (result.ok) onClose();
        // Refused: close the warning, so the message below the form isn't hidden behind it.
        else setLookAlikes(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Same schema the server uses -- instant feedback here, the real check there.
        const check = paymentSchema.safeParse({ amount, paidOn, mode, accountDetails });
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }
        if (amount > due) {
            setError(`Only ${formatRupees(due)} is due on #${contract.contractNumber}. Record the extra against the next contract.`);
            return;
        }

        const matches = orderPayments.filter(
            (p) => p.voidedAt === null && p.amount === amount && toIso(p.paidOn) === paidOn,
        );
        if (matches.length > 0) {
            setLookAlikes(matches);
            return;
        }
        await save();
    };

    // Editing the form means the warning no longer describes what will be saved.
    const changed = <T,>(set: (v: T) => void) => (v: T) => {
        set(v);
        setLookAlikes(null);
    };

    return (
        <Modal isOpen onClose={() => !isSubmitting && onClose()} title={`Add payment · contract #${contract.contractNumber}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-4 py-3 text-sm tabular-nums">
                    <div>
                        <p className="text-xs text-gray-500">{contract.charge === null ? "Rate" : "Charge"}</p>
                        <p className="font-semibold">{formatRupees(amountDue)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Paid</p>
                        <p className="font-semibold">{formatRupees(contract.paidAmount)}</p>
                    </div>
                    <div>
                        <p className="text-xs text-gray-500">Due</p>
                        <p className="font-semibold text-red-700">{formatRupees(due)}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Amount" htmlFor="payment-amount">
                        <RupeesInput id="payment-amount" value={amount} onChange={changed(setAmount)} />
                    </FormField>
                    <FormField label="Paid on" htmlFor="payment-paid-on">
                        <Input
                            id="payment-paid-on"
                            type="date"
                            max={today}
                            value={paidOn}
                            onChange={(e) => changed(setPaidOn)(e.target.value)}
                        />
                    </FormField>
                </div>

                <FormField label="How it was paid" htmlFor="payment-mode">
                    <Select id="payment-mode" value={mode} onChange={(e) => setMode(e.target.value as PaymentModeValue)}>
                        <option value="" disabled>
                            Select…
                        </option>
                        {PAYMENT_MODES.map((m) => (
                            <option key={m} value={m}>
                                {PAYMENT_MODE_LABELS[m]}
                            </option>
                        ))}
                    </Select>
                </FormField>

                <FormField label="Account details (optional)" htmlFor="payment-account">
                    <Input
                        id="payment-account"
                        maxLength={200}
                        value={accountDetails}
                        onChange={(e) => setAccountDetails(e.target.value)}
                        placeholder="e.g. Rama SBI"
                    />
                </FormField>

                {lookAlikes ? (
                    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
                        <p className="flex items-start gap-2 text-sm font-semibold text-amber-800">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            A payment of {formatRupees(amount)} on {formatDate(new Date(`${paidOn}T00:00:00.000Z`))} is
                            already recorded for this order. Are you sure this is a different payment?
                        </p>
                        <ul className="space-y-1 text-sm text-amber-900">
                            {lookAlikes.map((p) => (
                                <li key={p.id}>
                                    Contract #{p.contractNumber} · {formatRupees(p.amount)} · {PAYMENT_MODE_LABELS[p.mode]}
                                    {p.recordedBy && ` · by ${p.recordedBy.name}`}
                                </li>
                            ))}
                        </ul>
                        <div className="flex justify-end gap-2">
                            <Button type="button" variant="secondary" onClick={() => setLookAlikes(null)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                            <Button type="button" onClick={() => void save()} isLoading={isSubmitting}>
                                Proceed
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </Button>
                        <Button type="submit" isLoading={isSubmitting}>
                            Save payment
                        </Button>
                    </div>
                )}

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
