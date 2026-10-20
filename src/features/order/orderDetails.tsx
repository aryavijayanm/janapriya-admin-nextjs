"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarPlus, FileText, Hash, MapPin, Pencil, Phone, Play, StickyNote, UserRound, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/date";
import { formatCustomerCode } from "@/server/validators/customer";
import type { OrderDetails as Order } from "@/server/services/order.service";
import type { CoverageGap } from "@/server/domain/duty";
import { BRANCH_STYLES, ORDER_STATUS_STYLES } from "@/features/order/orderTable";
import { StartCareDialog } from "@/features/order/StartCareDialog";
import { UpdateDutyDialog } from "@/features/order/UpdateDutyDialog";
import { EditDutyDialog, type EditableDuty } from "@/features/order/EditDutyDialog";
import { ContractMoneyDialog, type ContractMoneyTarget } from "@/features/order/ContractMoneyDialog";

interface OrderDetailsProps {
    order: Order;
    gaps: CoverageGap[];
    /** null while the latest contract's end is still pending (or no contract yet). */
    nextContract: { opensOn: Date; defaultRate: number; defaultStaffSalary: number } | null;
    /** Kerala's today, yyyy-mm-dd. */
    today: string;
}

// Which dialog is open -- only ever one at a time.
type OpenDialog =
    | { kind: "startCare" }
    | { kind: "updateDuty" }
    | { kind: "editDuty"; duty: EditableDuty; canCancel: boolean }
    | { kind: "money"; target: ContractMoneyTarget; rate: number; staffSalary: number }
    | null;

// DATE columns arrive as midnight UTC, so the first 10 characters are the day.
const toIso = (date: Date) => date.toISOString().slice(0, 10);

const rupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

function Section({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    );
}

function FactChip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">
            <Icon className="w-4 h-4 text-primary" />
            {children}
        </span>
    );
}

/** "12/11/2026" or "12/11/2026 (half day)". */
function DayWithPart({ date, part }: { date: Date; part: "FULL" | "HALF" | null }) {
    return (
        <>
            {formatDate(date)}
            {part === "HALF" && <span className="text-gray-500"> (half day)</span>}
        </>
    );
}

export default function OrderDetails({ order, gaps, nextContract, today }: OrderDetailsProps) {
    const router = useRouter();
    const [dialog, setDialog] = useState<OpenDialog>(null);

    const status = ORDER_STATUS_STYLES[order.status];
    const branch = BRANCH_STYLES[order.branch];
    const isEnded = order.status === "ENDED";
    const hasStarted = order.contracts.length > 0;
    const onDuty = order.duties.find((d) => d.endDate === null) ?? null;
    const latest = order.contracts.at(-1);
    const canStartNext = !isEnded && !!nextContract && today >= toIso(nextContract.opensOn);
    const staffName = (id: number) => order.duties.find((d) => d.staffId === id)?.staff.name ?? "Staff";

    // Duty periods and the gaps between them, in date order, as one timeline.
    const timeline = [
        ...order.duties.map((duty) => ({ day: toIso(duty.startDate), duty, gap: null })),
        ...gaps.map((gap) => ({ day: toIso(gap.from), duty: null, gap })),
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
            // Only a plan that hasn't started can be removed; someone worked the rest.
            canCancel: toIso(duty.startDate) > today && order.duties.length > 1,
        });

    return (
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-md overflow-hidden">
            {/* ===== Header band ===== */}
            <div className="bg-linear-to-br from-pink-100 via-pink-50 to-purple-100 border-b border-gray-200 px-4 py-4 sm:px-8 sm:py-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} aria-label="Back" className="mb-2 -ml-2">
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>

                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900">
                                Order {order.code}
                            </h1>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${status.className}`}>
                                {status.label}
                            </span>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${branch.className}`}>
                                {branch.label}
                            </span>
                        </div>

                        <div className="mt-3 space-y-1.5">
                            <Link
                                href={`/customer/${order.customer.id}`}
                                className="flex w-fit items-center gap-3 text-lg font-semibold text-gray-800 hover:text-primary transition-colors"
                            >
                                <UserRound className="w-5 h-5 shrink-0 text-primary" />
                                {order.customer.name}
                            </Link>
                            <a
                                href={`tel:${order.customer.contactNumber1}`}
                                className="flex w-fit items-center gap-3 text-gray-700 hover:text-primary transition-colors"
                            >
                                <Phone className="w-5 h-5 shrink-0 text-primary" />
                                {order.customer.contactNumber1}
                            </a>
                            <p className="flex items-start gap-3 text-sm text-gray-600 whitespace-pre-line">
                                <MapPin className="w-5 h-5 shrink-0 text-primary" />
                                {order.customer.address}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end sm:shrink-0">
                        <FactChip icon={Hash}>{formatCustomerCode(order.customer.id)}</FactChip>
                        <FactChip icon={CalendarPlus}>Created {formatDate(order.createdAt)}</FactChip>
                    </div>
                </div>
            </div>

            {/* ===== Body ===== */}
            <div className="px-4 py-4 sm:px-8 sm:py-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section title="Services">
                        <div className="flex flex-wrap gap-2">
                            {order.services.map(({ service }) => (
                                <span
                                    key={service.id}
                                    className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary"
                                >
                                    {service.name}
                                </span>
                            ))}
                        </div>
                    </Section>
                    <Section title="Remarks">
                        <p className="flex items-start gap-2 text-sm text-gray-700 whitespace-pre-line">
                            <StickyNote className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                            {order.remarks ?? "—"}
                        </p>
                    </Section>
                </div>

                {/* ----- Contracts ----- */}
                <Section
                    title="Contracts"
                    action={
                        canStartNext && latest && nextContract ? (
                            <Button
                                size="sm"
                                onClick={() =>
                                    setDialog({
                                        kind: "money",
                                        target: { kind: "next", orderId: order.id, nextNumber: latest.contractNumber + 1 },
                                        rate: nextContract.defaultRate,
                                        staffSalary: nextContract.defaultStaffSalary,
                                    })
                                }
                            >
                                <FileText className="w-4 h-4" />
                                Start next contract
                            </Button>
                        ) : undefined
                    }
                >
                    {!hasStarted ? (
                        <p className="text-sm text-gray-500">Care hasn&apos;t started yet. Use “Start care” below.</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm tabular-nums">
                                <thead>
                                    <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wider text-gray-500">
                                        <th className="py-2 pr-4">#</th>
                                        <th className="py-2 pr-4">Start</th>
                                        <th className="py-2 pr-4">End</th>
                                        <th className="py-2 pr-4">Served</th>
                                        <th className="py-2 pr-4 text-right">Rate</th>
                                        <th className="py-2 pr-4 text-right">Staff salary</th>
                                        <th className="py-2" />
                                    </tr>
                                </thead>
                                <tbody>
                                    {order.contracts.map((c) => (
                                        <tr key={c.id} className="border-b border-gray-100 last:border-0">
                                            <td className="py-2 pr-4 font-semibold">#{c.contractNumber}</td>
                                            <td className="py-2 pr-4">{c.startDate ? formatDate(c.startDate) : "—"}</td>
                                            <td className="py-2 pr-4">
                                                {c.endDate ? (
                                                    formatDate(c.endDate)
                                                ) : (
                                                    <span className="text-amber-700" title="Depends on the next staff">
                                                        pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2 pr-4">{c.servedDays}/28</td>
                                            <td className="py-2 pr-4 text-right">{rupees(c.rate)}</td>
                                            <td className="py-2 pr-4 text-right">{rupees(c.staffSalary)}</td>
                                            <td className="py-2 text-right">
                                                {!isEnded && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        aria-label={`Edit contract #${c.contractNumber}`}
                                                        onClick={() =>
                                                            setDialog({
                                                                kind: "money",
                                                                target: { kind: "edit", contractId: c.id, contractNumber: c.contractNumber },
                                                                rate: c.rate,
                                                                staffSalary: c.staffSalary,
                                                            })
                                                        }
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {nextContract && !canStartNext && !isEnded && (
                                <p className="mt-3 text-xs text-gray-500">
                                    The next contract can be started from {formatDate(nextContract.opensOn)}.
                                </p>
                            )}
                        </div>
                    )}
                </Section>

                {/* ----- Duty timeline ----- */}
                <Section
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
                                            <Link
                                                href={`/staff/${entry.duty.staff.id}`}
                                                className="font-semibold text-gray-900 hover:text-primary"
                                            >
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
                                            {entry.duty.endNote && (
                                                <p className="mt-0.5 text-sm italic text-gray-500">{entry.duty.endNote}</p>
                                            )}
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
                </Section>
            </div>

            {/* ===== Actions ===== */}
            <div className="flex flex-wrap gap-3 px-4 py-4 sm:px-8 border-t border-gray-200 bg-gray-50">
                {!hasStarted && !isEnded && (
                    <Button variant="success" onClick={() => setDialog({ kind: "startCare" })}>
                        <Play className="w-4 h-4" />
                        Start care
                    </Button>
                )}
                {!isEnded && (
                    <Button variant="secondary" onClick={() => router.push(`/orders/${order.code}/edit`)}>
                        <Pencil className="w-4 h-4" />
                        Edit order
                    </Button>
                )}
            </div>

            {/* ===== Dialogs (one at a time) ===== */}
            {dialog?.kind === "startCare" && (
                <StartCareDialog orderId={order.id} today={today} onClose={() => setDialog(null)} />
            )}
            {dialog?.kind === "updateDuty" && (
                <UpdateDutyDialog
                    orderId={order.id}
                    onDutyStaffName={onDuty?.staff.name ?? null}
                    today={today}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.kind === "editDuty" && (
                <EditDutyDialog
                    orderId={order.id}
                    duty={dialog.duty}
                    canCancel={dialog.canCancel}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog?.kind === "money" && (
                <ContractMoneyDialog
                    target={dialog.target}
                    initialRate={dialog.rate}
                    initialStaffSalary={dialog.staffSalary}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}
