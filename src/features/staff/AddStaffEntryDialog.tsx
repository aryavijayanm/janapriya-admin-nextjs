"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DateTextInput } from "@/components/ui/DateTextInput";
import { parseDayMonthYear } from "@/lib/date";
import { useServerAction } from "@/hooks/useServerAction";
import { RupeesInput } from "@/features/order/dutyFields";
import { addStaffEntryAction } from "@/features/staff/staff.actions";
import {
    STAFF_PAYMENT_MODES,
    STAFF_PAYMENT_MODE_LABELS,
    STAFF_ENTRY_TYPE_LABELS,
    staffEntrySchema,
    type StaffPaymentModeValue,
} from "@/server/validators/staff-account";

// "+ Add entry" on the staff account:
//   Paid to staff -- salary, advance, mobile recharge, money they took... (needs "how")
//   Earning       -- a one-time amount added for them (EXTRA); the contract salary stays as it is
// The amount is always typed positive; the server stores the sign.
export function AddStaffEntryDialog({ staffId, onClose }: { staffId: number; onClose: () => void }) {
    const [type, setType] = useState<"PAID" | "EXTRA">("PAID");
    const [amount, setAmount] = useState(Number.NaN);
    const [date, setDate] = useState("");
    const [mode, setMode] = useState<StaffPaymentModeValue | "">("");
    const [remarks, setRemarks] = useState("");
    const [accountDetails, setAccountDetails] = useState("");
    const { run, isPending, error, setError } = useServerAction();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const entryDate = parseDayMonthYear(date);
        if (!entryDate) {
            setError("Please type the date as DD/MM/YYYY, e.g. 05/11/2026");
            return;
        }
        const payload =
            type === "PAID"
                ? { type, amount, entryDate, remarks, mode, accountDetails }
                : { type, amount, entryDate, remarks };
        // Same schema the server uses -- instant feedback here, the real check there.
        const check = staffEntrySchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        const result = await run(() => addStaffEntryAction(staffId, payload));
        if (result.ok) onClose();
    };

    return (
        <Modal isOpen onClose={() => !isPending && onClose()} title="Add entry" size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                {/* What kind of line -- decides the column and the required boxes. */}
                <div className="grid grid-cols-2 gap-2">
                    {(
                        [
                            ["PAID", STAFF_ENTRY_TYPE_LABELS.PAID, "Salary, advance, recharge…"],
                            ["EXTRA", STAFF_ENTRY_TYPE_LABELS.EXTRA, "One-time amount added for them"],
                        ] as const
                    ).map(([value, label, hint]) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => setType(value)}
                            className={`rounded-lg border px-3 py-2 text-left text-sm ${
                                type === value ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-gray-300"
                            }`}
                        >
                            <p className="font-semibold text-gray-900">{label}</p>
                            <p className="text-xs text-gray-500">{hint}</p>
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Amount" htmlFor="entry-amount">
                        <RupeesInput id="entry-amount" value={amount} onChange={setAmount} />
                    </FormField>
                    <FormField label={type === "PAID" ? "Date of pay" : "Date"} htmlFor="entry-date">
                        <DateTextInput id="entry-date" value={date} onChange={setDate} />
                    </FormField>
                </div>

                {type === "PAID" && (
                    <FormField label="How it was paid" htmlFor="entry-mode">
                        <Select id="entry-mode" value={mode} onChange={(e) => setMode(e.target.value as StaffPaymentModeValue)}>
                            <option value="" disabled>
                                Select…
                            </option>
                            {STAFF_PAYMENT_MODES.map((m) => (
                                <option key={m} value={m}>
                                    {STAFF_PAYMENT_MODE_LABELS[m]}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                )}

                <FormField label="Remarks" htmlFor="entry-remarks">
                    <Input
                        id="entry-remarks"
                        maxLength={200}
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder={type === "PAID" ? "e.g. Salary, Advance, Mobile recharge" : "e.g. Festival extra"}
                    />
                </FormField>

                {type === "PAID" && (
                    <FormField label="Account details (optional)" htmlFor="entry-account">
                        <Input
                            id="entry-account"
                            maxLength={200}
                            value={accountDetails}
                            onChange={(e) => setAccountDetails(e.target.value)}
                        />
                    </FormField>
                )}

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isPending}>
                        Save entry
                    </Button>
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
