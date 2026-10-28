"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { StaffPicker, type PickedStaff } from "@/features/order/StaffPicker";
import { DayPartSelect, RupeesInput, type DayPartValue } from "@/features/order/dutyFields";
import { startCareAction } from "@/features/order/order.actions";
import { startCareSchema } from "@/server/validators/order";

interface StartCareDialogProps {
    orderId: number;
    /** Kerala's today, yyyy-mm-dd -- the default start date. */
    today: string;
    onClose: () => void;
}

// Creates contract #1 and the first duty period together. Only the start date
// is ever typed for a contract -- every end date is calculated from duty.
export function StartCareDialog({ orderId, today, onClose }: StartCareDialogProps) {
    const [startDate, setStartDate] = useState(today);
    const [startDayPart, setStartDayPart] = useState<DayPartValue | "">("");
    const [staff, setStaff] = useState<PickedStaff | null>(null);
    const [rate, setRate] = useState(Number.NaN);
    const [staffSalary, setStaffSalary] = useState(Number.NaN);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const payload = { startDate, startDayPart, staffId: staff?.id, rate, staffSalary };
        // Same schema the server uses -- instant feedback here, the real check there.
        const check = startCareSchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await startCareAction(orderId, payload);
            if (result.ok) onClose(); // the page refreshes itself with the new contract
            else setError(result.error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen onClose={() => !isSubmitting && onClose()} title="Start care" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Start date" htmlFor="start-date">
                        <Input
                            id="start-date"
                            type="date"
                            max={today} // care is entered once it has started
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setStaff(null); // availability depends on the date
                            }}
                        />
                    </FormField>
                    <FormField label="First day" htmlFor="start-day-part">
                        <DayPartSelect id="start-day-part" value={startDayPart} onChange={setStartDayPart} />
                    </FormField>
                </div>

                <FormField label="Staff" htmlFor="staff">
                    {startDate ? (
                        <StaffPicker orderId={orderId} onDate={startDate} value={staff} onChange={setStaff} />
                    ) : (
                        <p className="text-sm text-gray-500">Choose a start date first.</p>
                    )}
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Customer rate (per 28 days)" htmlFor="rate">
                        <RupeesInput id="rate" value={rate} onChange={setRate} />
                    </FormField>
                    <FormField label="Staff salary (per 28 days)" htmlFor="staff-salary">
                        <RupeesInput id="staff-salary" value={staffSalary} onChange={setStaffSalary} />
                    </FormField>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        Start care
                    </Button>
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
