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
import { updateDutyAction } from "@/features/order/order.actions";
import { updateDutySchema } from "@/server/validators/order";

interface UpdateDutyDialogProps {
    orderId: number;
    /** The staff member on duty right now, or null when nobody is. */
    onDutyStaffName: string | null;
    /** Kerala's today, yyyy-mm-dd. */
    today: string;
    onClose: () => void;
}

/** yyyy-mm-dd plus one calendar day (UTC maths, so no timezone can shift it). */
function dayAfter(isoDate: string): string {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
}

// The one "Update duty" button. Two shapes, matching updateDutySchema:
//   someone on duty -> "stop": when they stop, why (optional), and who takes over (optional)
//   nobody on duty  -> "start": who starts, from when (a return after leave, or new staff)
// Leave is never chosen from a list: stopping with nobody next leaves a gap, and
// the order page names that gap from what happens after it.
export function UpdateDutyDialog({ orderId, onDutyStaffName, today, onClose }: UpdateDutyDialogProps) {
    const mode = onDutyStaffName ? "stop" : "start";

    // "stop" fields
    const [stopDate, setStopDate] = useState(today);
    const [stopDayPart, setStopDayPart] = useState<DayPartValue | "">("");
    const [endNote, setEndNote] = useState("");
    const [hasNext, setHasNext] = useState(false);

    // The starting staff: the next one in "stop" mode, or the one in "start" mode.
    const [staff, setStaff] = useState<PickedStaff | null>(null);
    const [startDate, setStartDate] = useState(today);
    const [startDayPart, setStartDayPart] = useState<DayPartValue | "">("");

    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Ticking "someone takes over" suggests the next start DATE -- never after
    // today (duty is entered once it has happened): the day after a full last
    // day, otherwise the same day (half-day handover, or left early unpaid).
    // The next staff's first day (full/half/no pay) is NOT filled in: it must
    // be chosen, like every day part.
    const handleHasNextChange = (checked: boolean) => {
        setHasNext(checked);
        if (checked && stopDate) {
            const suggested = stopDayPart === "FULL" ? dayAfter(stopDate) : stopDate;
            setStartDate(suggested > today ? today : suggested);
            setStartDayPart("");
            setStaff(null);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const starting = { staffId: staff?.id, startDate, startDayPart };
        const payload =
            mode === "stop"
                ? { mode, stopDate, stopDayPart, endNote, next: hasNext ? starting : null }
                : { mode, ...starting };

        const check = updateDutySchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await updateDutyAction(orderId, payload);
            if (result.ok) onClose();
            else setError(result.error);
        } finally {
            setIsSubmitting(false);
        }
    };

    const startingFields = (
        <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Starts on" htmlFor="duty-start-date">
                    <Input
                        id="duty-start-date"
                        type="date"
                        max={today}
                        value={startDate}
                        onChange={(e) => {
                            setStartDate(e.target.value);
                            setStaff(null); // availability depends on the date
                        }}
                    />
                </FormField>
                <FormField label="First day" htmlFor="duty-start-day-part">
                    <DayPartSelect id="duty-start-day-part" value={startDayPart} onChange={setStartDayPart} />
                </FormField>
            </div>
            <FormField label="Staff" htmlFor="duty-staff">
                {startDate ? (
                    <StaffPicker orderId={orderId} onDate={startDate} value={staff} onChange={setStaff} />
                ) : (
                    <p className="text-sm text-gray-500">Choose a start date first.</p>
                )}
            </FormField>
        </>
    );

    return (
        <Modal isOpen onClose={() => !isSubmitting && onClose()} title="Update duty" size="lg">
            <form onSubmit={handleSubmit} className="space-y-5">
                {mode === "stop" ? (
                    <>
                        <p className="text-sm text-gray-600">
                            <span className="font-semibold text-gray-900">{onDutyStaffName}</span> is on duty now.
                            When do they stop?
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Stops on" htmlFor="stop-date">
                                <Input
                                    id="stop-date"
                                    type="date"
                                    max={today}
                                    value={stopDate}
                                    onChange={(e) => setStopDate(e.target.value)}
                                />
                            </FormField>
                            <FormField label="Last day" htmlFor="stop-day-part">
                                <DayPartSelect id="stop-day-part" value={stopDayPart} onChange={setStopDayPart} />
                            </FormField>
                        </div>
                        <FormField label="Note (optional)" htmlFor="end-note">
                            <TextArea
                                id="end-note"
                                rows={2}
                                value={endNote}
                                onChange={(e) => setEndNote(e.target.value)}
                                placeholder="e.g. going home for a family function"
                            />
                        </FormField>

                        <Checkbox
                            id="has-next"
                            label="Someone else takes over"
                            checked={hasNext}
                            onChange={(e) => handleHasNextChange(e.target.checked)}
                        />
                        {hasNext ? (
                            <div className="space-y-4 rounded-lg border border-gray-200 p-4">{startingFields}</div>
                        ) : (
                            <p className="text-xs text-gray-500">
                                Nobody is put on duty after the stop. Those days are not counted in the contract
                                until someone starts again.
                            </p>
                        )}
                    </>
                ) : (
                    <>
                        <p className="text-sm text-gray-600">Nobody is on duty now. Who starts, and from when?</p>
                        {startingFields}
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
