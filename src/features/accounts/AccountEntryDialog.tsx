"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DateTextInput } from "@/components/ui/DateTextInput";
import { formatDate, parseDayMonthYear } from "@/lib/date";
import { useServerAction } from "@/hooks/useServerAction";
import { RupeesInput } from "@/features/order/dutyFields";
import { addAccountEntryAction, updateAccountEntryAction } from "@/features/accounts/accounts.actions";
import {
    ACCOUNT_DIRECTION_LABELS,
    ACCOUNT_ENTRY_MODES,
    ACCOUNT_ENTRY_MODE_LABELS,
    accountEntrySchema,
} from "@/server/validators/account-book";
import type { AccountBookRow } from "@/server/services/account-book.service";

interface AccountEntryDialogProps {
    /** Edit this typed entry; leave out to add a new one. */
    entry?: AccountBookRow;
    /** Today in Kerala, DD/MM/YYYY -- the date box starts with it when adding. */
    today: string;
    onClose: () => void;
}

// "+ Add entry" and the row's Edit icon -- one popup, two uses. When editing,
// the boxes start filled with the entry's values. The same schema checks the
// form here (instant message) and on the server (the real check).
export function AccountEntryDialog({ entry, today, onClose }: AccountEntryDialogProps) {
    const [date, setDate] = useState(entry ? formatDate(entry.date) : today);
    const [direction, setDirection] = useState<string>(entry?.direction ?? "");
    const [amount, setAmount] = useState(entry?.amount ?? Number.NaN);
    const [mode, setMode] = useState(entry?.mode ?? "");
    const [reason, setReason] = useState(entry?.remarks ?? "");
    const { run, isPending, error, setError } = useServerAction();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const entryDate = parseDayMonthYear(date);
        if (!entryDate) {
            setError("Please type the date as DD/MM/YYYY, e.g. 05/11/2026");
            return;
        }
        const payload = { entryDate, direction, amount, mode, reason };
        const check = accountEntrySchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        const result = await run(() =>
            entry ? updateAccountEntryAction(entry.id, payload) : addAccountEntryAction(payload),
        );
        if (result.ok) onClose();
    };

    return (
        <Modal isOpen onClose={() => !isPending && onClose()} title={entry ? "Edit entry" : "Add entry"} size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Date" htmlFor="account-date">
                        <DateTextInput id="account-date" value={date} onChange={setDate} />
                    </FormField>
                    <FormField label="Receipt / Payment" htmlFor="account-direction">
                        <Select id="account-direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
                            <option value="" disabled>
                                Select…
                            </option>
                            {/* Receipt first, same order as the table's columns. */}
                            {(["IN", "OUT"] as const).map((d) => (
                                <option key={d} value={d}>
                                    {ACCOUNT_DIRECTION_LABELS[d]} {d === "IN" ? "(money received)" : "(money spent)"}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <FormField label="Amount" htmlFor="account-amount">
                        <RupeesInput id="account-amount" value={amount} onChange={setAmount} />
                    </FormField>
                    <FormField label="How" htmlFor="account-mode">
                        <Select id="account-mode" value={mode} onChange={(e) => setMode(e.target.value)}>
                            <option value="" disabled>
                                Select…
                            </option>
                            {ACCOUNT_ENTRY_MODES.map((m) => (
                                <option key={m} value={m}>
                                    {ACCOUNT_ENTRY_MODE_LABELS[m]}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                </div>

                <FormField label="Reason" htmlFor="account-reason">
                    <Input
                        id="account-reason"
                        maxLength={200}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. November rent, Lunch for office, Water can"
                    />
                </FormField>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isPending}>
                        {entry ? "Save changes" : "Save entry"}
                    </Button>
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
