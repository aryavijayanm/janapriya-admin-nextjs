"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import { voidPaymentAction, voidRefundAction } from "@/features/order/order.actions";
import { useServerAction } from "@/hooks/useServerAction";
import { PAYMENT_MODE_LABELS, voidPaymentSchema, type PaymentModeValue } from "@/server/validators/payment";

interface VoidPaymentDialogProps {
    payment: { id: number; amount: number; paidOn: Date; mode: PaymentModeValue };
    /** "refund" = a refund (money given back), same rules and wording. */
    kind?: "payment" | "refund";
    onClose: () => void;
}

// Voiding is the only way to correct a payment or a refund: it stays in the
// history, crossed out with who/when/why, and stops counting. Then record it again.
export function VoidPaymentDialog({ payment, kind = "payment", onClose }: VoidPaymentDialogProps) {
    const [reason, setReason] = useState("");
    const { run, isPending: isSubmitting, error, setError } = useServerAction();

    const handleVoid = async () => {
        const check = voidPaymentSchema.safeParse({ reason });
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please give a reason.");
            return;
        }
        const result = await run(() =>
            kind === "refund" ? voidRefundAction(payment.id, { reason }) : voidPaymentAction(payment.id, { reason }),
        );
        if (result.ok) onClose();
    };

    return (
        <Modal isOpen onClose={() => !isSubmitting && onClose()} title={`Void ${kind}`} size="sm">
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    Void <span className="font-semibold text-gray-900">{formatRupees(payment.amount)}</span> (
                    {PAYMENT_MODE_LABELS[payment.mode]}, {formatDate(payment.paidOn)})? It stays in the history,
                    crossed out, and no longer counts. If it was only entered wrongly, record it again afterwards.
                </p>
                <FormField label="Reason" htmlFor="void-reason">
                    <Input
                        id="void-reason"
                        maxLength={200}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. wrong mode"
                        autoFocus
                    />
                </FormField>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Keep it
                    </Button>
                    <Button variant="danger" onClick={handleVoid} isLoading={isSubmitting}>
                        Void {kind}
                    </Button>
                </div>
                {error && <Alert variant="error">{error}</Alert>}
            </div>
        </Modal>
    );
}
