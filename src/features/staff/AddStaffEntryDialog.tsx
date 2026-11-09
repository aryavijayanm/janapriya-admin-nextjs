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
import { formatRupees } from "@/lib/money";
import { useServerAction } from "@/hooks/useServerAction";
import { RupeesInput } from "@/features/order/dutyFields";
import { addStaffEntryAction } from "@/features/staff/staff.actions";
import {
    STAFF_PAYMENT_MODES,
    STAFF_PAYMENT_MODE_LABELS,
    STAFF_RECEIVED_MODES,
    STAFF_RECEIVED_MODE_LABELS,
    STAFF_ENTRY_TYPE_LABELS,
    staffEntrySchema,
    type StaffEntryTypeValue,
} from "@/server/validators/staff-account";

interface AddStaffEntryDialogProps {
    staffId: number;
    /** What the staff owes now (live balance); 0 when they don't owe. */
    owes: number;
    /** Owner only: may add a Write off. */
    canWriteOff: boolean;
    onClose: () => void;
}

const HINTS: Record<StaffEntryTypeValue, string> = {
    PAID: "Salary, advance, recharge…",
    EXTRA: "One-time amount added for them",
    RECEIVED: "Money they paid back",
    WRITE_OFF: "Forgive what they owe",
};

// "+ Add entry" on the staff account:
//   Paid to staff       -- salary, advance, mobile recharge, money they took... (needs "how")
//   Earning             -- a one-time amount added for them (EXTRA); the contract salary stays as it is
//   Received from staff -- only while they owe: money paid back (needs "how")
//   Write off           -- only while they owe, Owner only: the debt forgiven
// The amount is always typed positive; the server stores the sign. Received /
// Write off can't be more than they owe (checked here and, for real, on the server).
export function AddStaffEntryDialog({ staffId, owes, canWriteOff, onClose }: AddStaffEntryDialogProps) {
    const types: StaffEntryTypeValue[] = [
        "PAID",
        "EXTRA",
        ...(owes > 0 ? (["RECEIVED"] as const) : []),
        ...(owes > 0 && canWriteOff ? (["WRITE_OFF"] as const) : []),
    ];
    const [type, setType] = useState<StaffEntryTypeValue>("PAID");
    const [amount, setAmount] = useState(Number.NaN);
    const [date, setDate] = useState("");
    const [mode, setMode] = useState("");
    const [remarks, setRemarks] = useState("");
    const [accountDetails, setAccountDetails] = useState("");
    const { run, isPending, error, setError } = useServerAction();

    const movesMoney = type === "PAID" || type === "RECEIVED";
    const closesDebt = type === "RECEIVED" || type === "WRITE_OFF";

    const chooseType = (value: StaffEntryTypeValue) => {
        setType(value);
        setMode(""); // the "how" lists differ by direction
        setError("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const entryDate = parseDayMonthYear(date);
        if (!entryDate) {
            setError("Please type the date as DD/MM/YYYY, e.g. 05/11/2026");
            return;
        }
        if (closesDebt && amount > owes) {
            setError(`Amount from staff is only ${formatRupees(owes)}. Please check the amount.`);
            return;
        }
        const payload = movesMoney
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
                    {types.map((value) => (
                        <button
                            key={value}
                            type="button"
                            onClick={() => chooseType(value)}
                            className={`rounded-lg border px-3 py-2 text-left text-sm ${
                                type === value ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-gray-300"
                            }`}
                        >
                            <p className="font-semibold text-gray-900">{STAFF_ENTRY_TYPE_LABELS[value]}</p>
                            <p className="text-xs text-gray-500">{HINTS[value]}</p>
                        </button>
                    ))}
                </div>

                {closesDebt && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        Amount from staff now: <strong>{formatRupees(owes)}</strong>. You can enter up to this amount.
                    </p>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Amount" htmlFor="entry-amount">
                        <RupeesInput id="entry-amount" value={amount} onChange={setAmount} />
                    </FormField>
                    <FormField
                        label={type === "PAID" ? "Date of pay" : type === "RECEIVED" ? "Date received" : "Date"}
                        htmlFor="entry-date"
                    >
                        <DateTextInput id="entry-date" value={date} onChange={setDate} />
                    </FormField>
                </div>

                {movesMoney && (
                    <FormField label={type === "PAID" ? "How it was paid" : "How it was received"} htmlFor="entry-mode">
                        <Select id="entry-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                            <option value="" disabled>
                                Select…
                            </option>
                            {type === "PAID"
                                ? STAFF_PAYMENT_MODES.map((m) => (
                                      <option key={m} value={m}>
                                          {STAFF_PAYMENT_MODE_LABELS[m]}
                                      </option>
                                  ))
                                : STAFF_RECEIVED_MODES.map((m) => (
                                      <option key={m} value={m}>
                                          {STAFF_RECEIVED_MODE_LABELS[m]}
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
                        placeholder={
                            type === "PAID"
                                ? "e.g. Salary, Advance, Mobile recharge"
                                : type === "EXTRA"
                                  ? "e.g. Festival extra"
                                  : type === "RECEIVED"
                                    ? "e.g. Paid back the advance"
                                    : "e.g. Left due to illness, owner forgave"
                        }
                    />
                </FormField>

                {movesMoney && (
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
