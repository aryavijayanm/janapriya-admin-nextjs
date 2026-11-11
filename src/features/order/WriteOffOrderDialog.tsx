"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { TextArea } from "@/components/ui/TextArea";
import { DateTextInput } from "@/components/ui/DateTextInput";
import { formatDate, parseDayMonthYear } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import { useServerAction } from "@/hooks/useServerAction";
import { writeOffOrderAction } from "@/features/order/order.actions";
import { writeOffSchema } from "@/server/validators/payment";

interface WriteOffOrderDialogProps {
    orderId: number;
    code: string;
    endDate: Date;
    /** Each contract still owing, with what will be written off (its whole remaining balance). */
    owing: { contractNumber: number; amount: number }[];
    onClose: () => void;
}

// "Write off" (Owner only, ended orders): the final decision that the unpaid
// balance will never be collected. Shows exactly what will be written off --
// the whole remaining balance of each contract still owing -- and asks for
// the date and reason. Can't be undone, and says so.
export function WriteOffOrderDialog({ orderId, code, endDate, owing, onClose }: WriteOffOrderDialogProps) {
    const [date, setDate] = useState("");
    const [reason, setReason] = useState("");
    const { run, isPending, error, setError } = useServerAction();
    const total = owing.reduce((sum, c) => sum + c.amount, 0);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const writtenOffOn = parseDayMonthYear(date);
        if (!writtenOffOn) {
            setError("Please type the write-off date as DD/MM/YYYY, e.g. 05/11/2026");
            return;
        }
        const payload = { writtenOffOn, reason };
        const check = writeOffSchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }
        const result = await run(() => writeOffOrderAction(orderId, payload));
        if (result.ok) onClose();
    };

    return (
        <Modal isOpen onClose={() => !isPending && onClose()} title={`Write off · order ${code}`} size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="rounded-lg border border-gray-200 p-4 text-sm tabular-nums">
                    <p className="mb-2 text-gray-600">The customer will not pay:</p>
                    <ul className="space-y-1">
                        {owing.map((c) => (
                            <li key={c.contractNumber} className="flex justify-between">
                                <span>Contract #{c.contractNumber}</span>
                                <span className="font-semibold">{formatRupees(c.amount)}</span>
                            </li>
                        ))}
                    </ul>
                    <p className="mt-2 flex justify-between border-t border-gray-200 pt-2 font-bold">
                        <span>Total to write off</span>
                        <span>{formatRupees(total)}</span>
                    </p>
                </div>

                <FormField label="Date of write-off" htmlFor="write-off-date">
                    <DateTextInput id="write-off-date" value={date} onChange={setDate} />
                </FormField>
                <p className="-mt-3 text-xs text-gray-500">Not before the order ended ({formatDate(endDate)}), not in the future.</p>

                <FormField label="Reason" htmlFor="write-off-reason">
                    <TextArea
                        id="write-off-reason"
                        rows={2}
                        maxLength={200}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Family can't pay; decided after talking with them"
                    />
                </FormField>

                <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    This can&apos;t be undone. No more payments can be recorded for these contracts, and the order&apos;s
                    end can&apos;t be undone afterwards.
                </p>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button type="submit" variant="danger" isLoading={isPending}>
                        Write off {formatRupees(total)}
                    </Button>
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
