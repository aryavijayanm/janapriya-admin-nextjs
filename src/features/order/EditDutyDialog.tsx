"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { FormField } from "@/components/ui/FormField";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { StaffPicker, type PickedStaff } from "@/features/order/StaffPicker";
import { DayPartSelect, type DayPartValue } from "@/features/order/dutyFields";
import { editDutyAction } from "@/features/order/order.actions";
import { editDutySchema } from "@/server/validators/order";

/** One duty period as the order page has it. */
export interface EditableDuty {
    id: number;
    staff: PickedStaff;
    startDate: Date;
    startDayPart: DayPartValue;
    endDate: Date | null;
    endDayPart: DayPartValue | null;
    endNote: string | null;
}

interface EditDutyDialogProps {
    orderId: number;
    duty: EditableDuty;
    /** Kerala's today, yyyy-mm-dd -- the latest date allowed (duty is entered once it has happened). */
    today: string;
    onClose: () => void;
}

// DATE columns arrive as midnight UTC, so the first 10 characters are the day.
const toIso = (date: Date) => date.toISOString().slice(0, 10);

// Corrects one duty period (wrong date, wrong staff, a stop entered too early).
// Contract dates recalculate on the server after saving. There is no delete:
// a duty period is a fact, and a removed one couldn't be put back in between
// two others -- so mistakes are fixed by editing.
export function EditDutyDialog({ orderId, duty, today, onClose }: EditDutyDialogProps) {
    const [staff, setStaff] = useState<PickedStaff | null>(duty.staff);
    const [startDate, setStartDate] = useState(toIso(duty.startDate));
    const [startDayPart, setStartDayPart] = useState<DayPartValue>(duty.startDayPart);
    const [stillWorking, setStillWorking] = useState(duty.endDate === null);
    const [endDate, setEndDate] = useState(duty.endDate ? toIso(duty.endDate) : startDate);
    // A saved stop keeps its choice; adding a stop (unticking "Still working")
    // starts empty and must be chosen.
    const [endDayPart, setEndDayPart] = useState<DayPartValue | "">(duty.endDayPart ?? "");
    const [endNote, setEndNote] = useState(duty.endNote ?? "");

    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const payload = {
            staffId: staff?.id,
            startDate,
            startDayPart,
            endDate: stillWorking ? null : endDate,
            endDayPart: stillWorking ? null : endDayPart,
            endNote: stillWorking ? "" : endNote,
        };
        if (!staff) {
            setError("Please choose a staff member");
            return;
        }
        const check = editDutySchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await editDutyAction(orderId, duty.id, payload);
            if (result.ok) onClose();
            else setError(result.error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen onClose={() => !isSubmitting && onClose()} title="Edit duty period" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                <FormField label="Staff" htmlFor="edit-duty-staff">
                    {startDate ? (
                        <StaffPicker orderId={orderId} onDate={startDate} value={staff} onChange={setStaff} />
                    ) : (
                        <p className="text-sm text-gray-500">Choose a start date first.</p>
                    )}
                </FormField>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Started on" htmlFor="edit-start-date">
                        <Input
                            id="edit-start-date"
                            type="date"
                            max={today}
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </FormField>
                    <FormField label="First day" htmlFor="edit-start-day-part">
                        <DayPartSelect id="edit-start-day-part" value={startDayPart} onChange={setStartDayPart} />
                    </FormField>
                </div>

                <Checkbox
                    id="edit-still-working"
                    label="Still working here (no stop date)"
                    checked={stillWorking}
                    onChange={(e) => setStillWorking(e.target.checked)}
                />

                {!stillWorking && (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Stopped on" htmlFor="edit-end-date">
                                <Input
                                    id="edit-end-date"
                                    type="date"
                                    max={today}
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </FormField>
                            <FormField label="Last day" htmlFor="edit-end-day-part">
                                <DayPartSelect id="edit-end-day-part" value={endDayPart} onChange={setEndDayPart} />
                            </FormField>
                        </div>
                        <FormField label="Note (optional)" htmlFor="edit-end-note">
                            <TextArea
                                id="edit-end-note"
                                rows={2}
                                value={endNote}
                                onChange={(e) => setEndNote(e.target.value)}
                            />
                        </FormField>
                    </>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        Save
                    </Button>
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
