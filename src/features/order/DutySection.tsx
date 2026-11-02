"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/date";
import type { OrderDetails as Order } from "@/server/services/order.service";
import type { CoverageGap } from "@/server/domain/duty";
import { SectionCard } from "@/features/order/SectionCard";
import { UpdateDutyDialog } from "@/features/order/UpdateDutyDialog";
import { EditDutyDialog, type EditableDuty } from "@/features/order/EditDutyDialog";

interface DutySectionProps {
    order: Order;
    /** The duty periods to show, oldest first -- all, or one page (see latestPage). */
    duties: Order["duties"];
    /** All of the order's gaps; only those right after a shown duty period appear. */
    gaps: CoverageGap[];
    /** Kerala's today, yyyy-mm-dd. */
    today: string;
    /** Under the list: "View all" link, or page buttons. */
    footer?: ReactNode;
}

type OpenDialog = { kind: "updateDuty" } | { kind: "editDuty"; duty: EditableDuty } | null;

// DATE columns arrive as midnight UTC, so the first 10 characters are the day.
const toIso = (date: Date) => date.toISOString().slice(0, 10);
const dayAfterIso = (date: Date) => toIso(new Date(date.getTime() + 24 * 60 * 60 * 1000));

/** "12/11/2026", "12/11/2026 (half day)" or "12/11/2026 (no pay)". */
function DayWithPart({ date, part }: { date: Date; part: "FULL" | "HALF" | "NO_PAY" | null }) {
    return (
        <>
            {formatDate(date)}
            {part === "HALF" && <span className="text-gray-500"> (half day)</span>}
            {part === "NO_PAY" && <span className="text-gray-500"> (no pay)</span>}
        </>
    );
}

// The duty timeline with its actions. Used by the order page (latest 7) and
// the "all staff duty" page (15 per page). Gap lines don't count towards the
// page size: a gap is shown when the duty period that ended just before it is
// on this page.
export function DutySection({ order, duties, gaps, today, footer }: DutySectionProps) {
    const [dialog, setDialog] = useState<OpenDialog>(null);

    const isEnded = order.status === "ENDED";
    const hasStarted = order.contracts.length > 0;
    const onDuty = order.duties.find((d) => d.endDate === null) ?? null;
    const staffName = (id: number) => order.duties.find((d) => d.staffId === id)?.staff.name ?? "Staff";

    const shownEnds = new Set(duties.filter((d) => d.endDate).map((d) => dayAfterIso(d.endDate!)));
    const shownGaps = gaps.filter((gap) => shownEnds.has(toIso(gap.from)));

    // Duty periods and their gaps, in date order, as one timeline.
    const timeline = [
        ...duties.map((duty) => ({ day: toIso(duty.startDate), duty, gap: null })),
        ...shownGaps.map((gap) => ({ day: toIso(gap.from), duty: null, gap })),
    ].sort((a, b) => a.day.localeCompare(b.day));

    const openEditDuty = (duty: Order["duties"][number]) =>
        setDialog({
            kind: "editDuty",
            duty: {
                id: duty.id,
                staff: { id: duty.staff.id, name: duty.staff.name },
                startDate: duty.startDate,
                startDayPart: duty.startDayPart,
                endDate: duty.endDate,
                endDayPart: duty.endDayPart,
                endNote: duty.endNote,
            },
        });

    return (
        <SectionCard
            title="Staff duty"
            action={
                hasStarted && !isEnded ? (
                    <Button size="sm" onClick={() => setDialog({ kind: "updateDuty" })}>
                        <Users className="w-4 h-4" />
                        Update duty
                    </Button>
                ) : undefined
            }
        >
            {timeline.length === 0 ? (
                <p className="text-sm text-gray-500">No staff on this order yet.</p>
            ) : (
                <ul className="space-y-2">
                    {timeline.map((entry) =>
                        entry.duty ? (
                            <li
                                key={`duty-${entry.duty.id}`}
                                className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-gray-200 px-4 py-3"
                            >
                                <div className="min-w-0">
                                    <Link href={`/staff/${entry.duty.staff.id}`} className="font-semibold text-gray-900 hover:text-primary">
                                        {entry.duty.staff.name}
                                    </Link>
                                    <span className="text-sm text-gray-500"> · {entry.duty.staff.place}</span>
                                    <p className="mt-0.5 text-sm text-gray-700">
                                        <DayWithPart date={entry.duty.startDate} part={entry.duty.startDayPart} />
                                        {" → "}
                                        {entry.duty.endDate ? (
                                            <DayWithPart date={entry.duty.endDate} part={entry.duty.endDayPart} />
                                        ) : (
                                            <span className="font-medium text-green-700">still working</span>
                                        )}
                                    </p>
                                    {entry.duty.endNote && <p className="mt-0.5 text-sm italic text-gray-500">{entry.duty.endNote}</p>}
                                </div>
                                {!isEnded && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        aria-label={`Edit ${entry.duty.staff.name}'s duty`}
                                        onClick={() => openEditDuty(entry.duty)}
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                )}
                            </li>
                        ) : (
                            <li
                                key={`gap-${entry.day}`}
                                className="rounded-lg border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800"
                            >
                                {entry.gap.to
                                    ? `No staff ${formatDate(entry.gap.from)} – ${formatDate(entry.gap.to)}`
                                    : `No staff since ${formatDate(entry.gap.from)}`}
                                {entry.gap.sameStaffReturned && ` (${staffName(entry.gap.staffBeforeId)} on leave)`}
                                <span className="text-amber-700"> · not counted in the contract</span>
                            </li>
                        ),
                    )}
                </ul>
            )}
            {footer}

            {dialog?.kind === "updateDuty" && (
                <UpdateDutyDialog
                    orderId={order.id}
                    onDutyStaffName={onDuty?.staff.name ?? null}
                    today={today}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.kind === "editDuty" && (
                <EditDutyDialog orderId={order.id} duty={dialog.duty} today={today} onClose={() => setDialog(null)} />
            )}
        </SectionCard>
    );
}
