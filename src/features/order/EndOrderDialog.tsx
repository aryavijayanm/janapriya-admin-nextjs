"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { TextArea } from "@/components/ui/TextArea";
import { formatDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import { useServerAction } from "@/hooks/useServerAction";
import { DayPartSelect } from "@/features/order/dutyFields";
import { endOrderAction, previewEndOrderAction } from "@/features/order/order.actions";
import { endOrderSchema } from "@/server/validators/order";
import { NOTE_MAX_LENGTH } from "@/server/validators/text";
import type { EndOrderSummary } from "@/server/services/order-end.service";

type DayPartValue = "FULL" | "HALF" | "NO_PAY";

interface EndOrderDialogProps {
    orderId: number;
    code: string;
    /** Whoever is on duty now (their duty stops on the last day), else null. */
    onDuty: { name: string; startDate: Date } | null;
    /** Nobody on duty: the last duty day -- the order ends on it. Null = care never started. */
    lastDutyDay: Date | null;
    /** Kerala's today, yyyy-mm-dd. */
    today: string;
    onClose: () => void;
}

// DATE columns arrive as midnight UTC, so the first 10 characters are the day.
const toIso = (date: Date) => date.toISOString().slice(0, 10);

// "End order": the last day (and the exit day part, if someone is on duty) +
// a reason, then "Check the amounts" shows exactly what saving will do --
// the server runs the real End order and rolls it back. Changing any field
// clears that preview, so what's confirmed is always what's saved.
export function EndOrderDialog({ orderId, code, onDuty, lastDutyDay, today, onClose }: EndOrderDialogProps) {
    const [lastDay, setLastDay] = useState("");
    const [exitDayPart, setExitDayPart] = useState<DayPartValue | "">("");
    const [endNote, setEndNote] = useState("");
    const [summary, setSummary] = useState<EndOrderSummary | null>(null);
    // The "can't end yet" popup -- on top, so it's seen without scrolling.
    const [showBlocked, setShowBlocked] = useState(false);
    const preview = useServerAction();
    const save = useServerAction();

    const payload = () => ({
        lastDay: onDuty ? lastDay : lastDutyDay ? toIso(lastDutyDay) : null,
        exitDayPart: onDuty ? exitDayPart : null,
        endNote,
    });

    // Any change makes the shown figures out of date.
    const changed = <T,>(set: (v: T) => void) => (v: T) => {
        set(v);
        setSummary(null);
    };

    const handlePreview = async (e: React.FormEvent) => {
        e.preventDefault();
        const input = payload();
        if (onDuty && (!input.lastDay || !input.exitDayPart)) {
            preview.setError(`Please enter the last day and choose how ${onDuty.name}'s last day counts.`);
            return;
        }
        const check = endOrderSchema.safeParse(input);
        if (!check.success) {
            preview.setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }
        const result = await preview.run(() => previewEndOrderAction(orderId, input));
        if (result.ok) {
            setSummary(result.summary);
            setShowBlocked(result.summary.blockedReason !== null);
        }
    };

    const handleEnd = async () => {
        const result = await save.run(() => endOrderAction(orderId, payload()));
        if (result.ok) onClose();
    };

    const busy = preview.isPending || save.isPending;

    return (
        <Modal isOpen onClose={() => !busy && onClose()} title={`End order ${code}`} size="lg">
            <form onSubmit={handlePreview} className="space-y-5">
                {onDuty ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField label="Last day of care" htmlFor="end-last-day">
                            <Input
                                id="end-last-day"
                                type="date"
                                min={toIso(onDuty.startDate)}
                                max={today}
                                value={lastDay}
                                onChange={(e) => changed(setLastDay)(e.target.value)}
                            />
                        </FormField>
                        <FormField label={`${onDuty.name}'s last day is`} htmlFor="end-day-part">
                            <DayPartSelect id="end-day-part" value={exitDayPart} onChange={changed(setExitDayPart)} />
                        </FormField>
                    </div>
                ) : (
                    <p className="rounded-lg bg-gray-50 px-4 py-3 text-sm text-gray-700">
                        {lastDutyDay
                            ? `Nobody is on duty. The order ends on the last duty day, ${formatDate(lastDutyDay)}.`
                            : "Care never started on this order. It just ends, with nothing to charge."}
                    </p>
                )}

                <FormField label="Reason (optional)" htmlFor="end-note">
                    <TextArea
                        id="end-note"
                        rows={2}
                        maxLength={NOTE_MAX_LENGTH}
                        value={endNote}
                        onChange={(e) => changed(setEndNote)(e.target.value)}
                        placeholder="e.g. Patient admitted to hospital"
                    />
                </FormField>

                {summary && (
                    <div className="space-y-2 rounded-lg border border-gray-200 p-4 text-sm tabular-nums">
                        <p className="font-semibold text-gray-900">
                            Ends on {formatDate(summary.endDate)}
                            {summary.stoppedStaff && ` · ${summary.stoppedStaff}'s duty stops`}
                        </p>
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                                    <th className="py-1 pr-3">#</th>
                                    <th className="py-1 pr-3">Served</th>
                                    <th className="py-1 pr-3 text-right">Rate</th>
                                    <th className="py-1 pr-3 text-right">Charge</th>
                                    <th className="py-1 pr-3 text-right">Paid</th>
                                    <th className="py-1 text-right">Result</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary.contracts.map((c) => (
                                    <tr key={c.contractNumber} className="border-b border-gray-100 last:border-0">
                                        <td className="py-1 pr-3 font-semibold">#{c.contractNumber}</td>
                                        <td className="py-1 pr-3">{c.servedDays}/28</td>
                                        <td className="py-1 pr-3 text-right">{formatRupees(c.rate)}</td>
                                        <td className="py-1 pr-3 text-right">{formatRupees(c.charge)}</td>
                                        <td className="py-1 pr-3 text-right">{formatRupees(c.paid)}</td>
                                        <td className="py-1 text-right font-semibold">
                                            {c.refund > 0 ? (
                                                <span className="text-amber-700">Refund {formatRupees(c.refund)}</span>
                                            ) : c.stillToPay > 0 ? (
                                                <span className="text-red-700">To pay {formatRupees(c.stillToPay)}</span>
                                            ) : (
                                                <span className="text-green-700">Settled</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {summary.removed.length > 0 && (
                            <p className="text-gray-600">
                                Contract {summary.removed.map((n) => `#${n}`).join(", ")} not started and never paid — removed.
                            </p>
                        )}
                        <p className="font-semibold">
                            {summary.totalRefund > 0 && <span className="mr-4 text-amber-700">Total refund {formatRupees(summary.totalRefund)}</span>}
                            {summary.totalStillToPay > 0 && <span className="text-red-700">Customer still to pay {formatRupees(summary.totalStillToPay)}</span>}
                            {summary.totalRefund === 0 && summary.totalStillToPay === 0 && <span className="text-green-700">Nothing to refund or collect.</span>}
                        </p>
                    </div>
                )}

                <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    Ending stops the duty and closes the order: no more duty or contract changes. Payments and refunds can
                    still be recorded, but not voided. It can be undone only until a refund or write-off is recorded.
                </p>

                <div className="flex justify-end gap-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
                        Cancel
                    </Button>
                    {summary ? (
                        <Button
                            type="button"
                            variant="danger"
                            onClick={handleEnd}
                            isLoading={save.isPending}
                            disabled={!!summary.blockedReason}
                        >
                            End order
                        </Button>
                    ) : (
                        <Button type="submit" isLoading={preview.isPending}>
                            Check the amounts
                        </Button>
                    )}
                </div>

                {preview.error && <Alert variant="error">{preview.error}</Alert>}
                {save.error && <Alert variant="error">{save.error}</Alert>}
            </form>

            {/* A refund while another contract still owes: fix the payments first
                (End order stays disabled; the server refuses too). Opened after the
                End order dialog, so it shows on top of it. */}
            {summary?.blockedReason && (
                <Modal isOpen={showBlocked} onClose={() => setShowBlocked(false)} title="Can't end this order yet" size="sm">
                    <div className="space-y-4">
                        <p className="flex items-start gap-2 text-sm text-gray-700">
                            <AlertTriangle className="w-5 h-5 shrink-0 text-red-600" />
                            {summary.blockedReason}
                        </p>
                        <div className="flex justify-end">
                            <Button onClick={() => setShowBlocked(false)}>OK</Button>
                        </div>
                    </div>
                </Modal>
            )}
        </Modal>
    );
}
