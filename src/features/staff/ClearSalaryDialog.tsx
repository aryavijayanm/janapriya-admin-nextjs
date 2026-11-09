"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
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
import { clearStaffSalaryAction } from "@/features/staff/staff.actions";
import {
    STAFF_PAYMENT_MODES,
    STAFF_PAYMENT_MODE_LABELS,
    clearSalarySchema,
    type StaffPaymentModeValue,
} from "@/server/validators/staff-account";

interface ClearSalaryDialogProps {
    staffId: number;
    staffName: string;
    totals: { carried: number; earned: number; extras: number; recovered: number; paid: number; balance: number };
    onClose: () => void;
}

// "Clear the salary now": shows how the final amount is made up, takes how
// and when it's paid, then the server stores the clearing and marks
// everything To settle as Settled. Never undone -- hence the plain warning.
export function ClearSalaryDialog({ staffId, staffName, totals, onClose }: ClearSalaryDialogProps) {
    const final = totals.balance;
    const [date, setDate] = useState("");
    const [mode, setMode] = useState<StaffPaymentModeValue | "">("");
    const [remarks, setRemarks] = useState("Final salary");
    const [accountDetails, setAccountDetails] = useState("");
    const { run, isPending, error, setError } = useServerAction();

    const handleClear = async (e: React.FormEvent) => {
        e.preventDefault();

        let payment = null;
        if (final > 0) {
            const paidOn = parseDayMonthYear(date);
            if (!paidOn) {
                setError("Please type the date of pay as DD/MM/YYYY, e.g. 05/11/2026");
                return;
            }
            payment = { paidOn, mode, remarks, accountDetails };
        }
        const payload = { expectedFinalAmount: final, payment };
        const check = clearSalarySchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        const result = await run(() => clearStaffSalaryAction(staffId, payload));
        if (result.ok) onClose();
    };

    const line = (label: string, amount: number, sign = "") => (
        <div className="flex justify-between">
            <span className="text-gray-600">{label}</span>
            <span className="font-medium">
                {sign}
                {formatRupees(Math.abs(amount))}
            </span>
        </div>
    );

    return (
        <Modal isOpen onClose={() => !isPending && onClose()} title={`Clear ${staffName}'s salary`} size="md">
            <form onSubmit={handleClear} className="space-y-5">
                <div className="space-y-1 rounded-lg bg-gray-50 px-4 py-3 text-sm tabular-nums">
                    {totals.carried !== 0 && line("Amount from staff (last clearing)", totals.carried, "−")}
                    {line("Duty to settle", totals.earned, totals.earned < 0 ? "−" : "+")}
                    {totals.extras !== 0 && line("Earnings added", totals.extras, "+")}
                    {totals.recovered !== 0 && line("Received / written off", totals.recovered, "+")}
                    {line("Already paid", totals.paid, "−")}
                    <div className="mt-2 flex justify-between border-t border-gray-200 pt-2 text-base font-bold">
                        <span>{final >= 0 ? "Final amount to pay" : "Amount from staff"}</span>
                        <span className={final < 0 ? "text-amber-700" : ""}>{formatRupees(Math.abs(final))}</span>
                    </div>
                </div>

                {final > 0 ? (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Date of pay" htmlFor="clear-date">
                                <DateTextInput id="clear-date" value={date} onChange={setDate} />
                            </FormField>
                            <FormField label="How it was paid" htmlFor="clear-mode">
                                <Select id="clear-mode" value={mode} onChange={(e) => setMode(e.target.value as StaffPaymentModeValue)}>
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
                        </div>
                        <FormField label="Remarks" htmlFor="clear-remarks">
                            <Input id="clear-remarks" maxLength={200} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                        </FormField>
                        <FormField label="Account details (optional)" htmlFor="clear-account">
                            <Input
                                id="clear-account"
                                maxLength={200}
                                value={accountDetails}
                                onChange={(e) => setAccountDetails(e.target.value)}
                            />
                        </FormField>
                    </>
                ) : (
                    <p className="text-sm text-gray-600">
                        {final === 0
                            ? "Nothing is left to pay."
                            : `Nothing to pay now. The amount from staff (${formatRupees(-final)}) is carried into the next period and comes off ${staffName}'s next earnings.`}
                    </p>
                )}

                <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    Clearing marks everything under To settle as Settled. It can&apos;t be undone — if a duty is changed
                    later, the difference shows up under To settle again and goes into the next payment.
                </p>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isPending}>
                        Clear the salary
                    </Button>
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
