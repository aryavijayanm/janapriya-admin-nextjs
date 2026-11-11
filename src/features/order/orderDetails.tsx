"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Ban,
    CalendarPlus,
    Hash,
    MapPin,
    Pencil,
    Phone,
    Play,
    RotateCcw,
    Square,
    StickyNote,
    Undo2,
    UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import { latestPage } from "@/lib/latestPage";
import { balanceDue, contractAmountDue } from "@/server/domain/payments";
import { formatCustomerCode } from "@/server/validators/customer";
import type { OrderDetails as Order } from "@/server/services/order.service";
import type { CoverageGap } from "@/server/domain/duty";
import { BRANCH_STYLES, orderStatusStyle } from "@/features/order/orderTable";
import { EndOrderDialog } from "@/features/order/EndOrderDialog";
import { UndoEndOrderDialog } from "@/features/order/UndoEndOrderDialog";
import { WriteOffOrderDialog } from "@/features/order/WriteOffOrderDialog";
import { SectionCard } from "@/features/order/SectionCard";
import { ContractsSection } from "@/features/order/ContractsSection";
import { DutySection } from "@/features/order/DutySection";
import { ViewAllLink } from "@/features/order/OrderSubpage";
import { StartCareDialog } from "@/features/order/StartCareDialog";

/** The order page shows only the latest few; the rest are one click away. */
const CONTRACTS_SHOWN = 5;
const DUTIES_SHOWN = 7;

interface OrderDetailsProps {
    order: Order;
    gaps: CoverageGap[];
    /** null while the latest contract's end is still pending (or no contract yet). */
    nextContract: { opensOn: Date; defaultRate: number; defaultStaffSalary: number } | null;
    /** Per contract id: days not counted (no paid staff); null = no dates yet. */
    leaveDays: Record<number, number | null>;
    /** Kerala's today, yyyy-mm-dd. */
    today: string;
    /** Owner: may write off an ended order's unpaid balance. */
    canWriteOff: boolean;
}

function FactChip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">
            <Icon className="w-4 h-4 text-primary" />
            {children}
        </span>
    );
}

// The order page: header, services, remarks, then the latest contracts and
// duty periods. The contract table and duty timeline are shared components
// (with their own buttons and dialogs), also used by the "view all" pages.
export default function OrderDetails({ order, gaps, nextContract, leaveDays, today, canWriteOff }: OrderDetailsProps) {
    const router = useRouter();
    const [startingCare, setStartingCare] = useState(false);
    const [dialog, setDialog] = useState<"end" | "undoEnd" | "writeOff" | null>(null);

    const status = orderStatusStyle(order);
    const branch = BRANCH_STYLES[order.branch];
    const isEnded = order.status === "ENDED";
    const hasStarted = order.contracts.length > 0;
    // Undo end only until money has gone back or been written off, and never
    // once restarted (the server checks too).
    const canUndoEnd =
        isEnded && !order.restartedAs && !order.writeOff && order.contracts.every((c) => c.refundedAmount === 0);
    // What a write-off would cover: each contract's whole remaining balance.
    const owing = order.contracts
        .map((c) => ({ contractNumber: c.contractNumber, amount: balanceDue(contractAmountDue(c), c.paidAmount) }))
        .filter((c) => c.amount > 0);
    const showWriteOff = canWriteOff && isEnded && !order.writeOff && owing.length > 0;
    const onDutyNow = order.duties.find((d) => d.endDate === null) ?? null;
    const lastDutyDay = order.duties.reduce<Date | null>(
        (latest, d) => (d.endDate && (!latest || d.endDate > latest) ? d.endDate : latest),
        null,
    );

    const contracts = latestPage(order.contracts, CONTRACTS_SHOWN);
    const duties = latestPage(order.duties, DUTIES_SHOWN);

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

                        {/* End and Restart, both ways. */}
                        <div className="mt-3 space-y-1 text-sm">
                            {isEnded && order.endDate && (
                                <p className="font-medium text-gray-700">
                                    Ended on {formatDate(order.endDate)}
                                    {order.endNote && <span className="font-normal text-gray-600"> — {order.endNote}</span>}
                                </p>
                            )}
                            {order.writeOff && (
                                <p className="flex w-fit items-center gap-1.5 font-medium text-gray-700">
                                    <Ban className="w-4 h-4 text-gray-500" />
                                    Written off {formatRupees(order.writeOff.amount)} on {formatDate(order.writeOff.writtenOffOn)}
                                    {" by "}
                                    {order.writeOff.recordedBy?.name ?? "a removed user"}
                                    <span className="font-normal text-gray-600"> — {order.writeOff.reason}</span>
                                </p>
                            )}
                            {order.restartedFrom && (
                                <Link href={`/orders/${order.restartedFrom.code}`} className="flex w-fit items-center gap-1.5 text-primary hover:underline">
                                    <RotateCcw className="w-4 h-4" />
                                    Restarted from {order.restartedFrom.code}
                                    {order.restartedFrom.endDate && ` (ended ${formatDate(order.restartedFrom.endDate)})`}
                                </Link>
                            )}
                            {order.restartedAs && (
                                <Link href={`/orders/${order.restartedAs.code}`} className="flex w-fit items-center gap-1.5 text-primary hover:underline">
                                    <RotateCcw className="w-4 h-4" />
                                    Restarted as {order.restartedAs.code} ({formatDate(order.restartedAs.createdAt)})
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end sm:shrink-0">
                        <FactChip icon={Hash}>{formatCustomerCode(order.customer.id)}</FactChip>
                        <FactChip icon={CalendarPlus}>Created {formatDate(order.createdAt)}</FactChip>
                        {!isEnded && (
                            <Button variant="primary" size="sm" onClick={() => router.push(`/orders/${order.code}/edit`)}>
                                <Pencil className="w-4 h-4" />
                                Edit order
                            </Button>
                        )}
                        {!isEnded && (
                            <Button variant="danger" size="sm" onClick={() => setDialog("end")}>
                                <Square className="w-4 h-4" />
                                End order
                            </Button>
                        )}
                        {canUndoEnd && (
                            <Button variant="secondary" size="sm" onClick={() => setDialog("undoEnd")}>
                                <Undo2 className="w-4 h-4" />
                                Undo end
                            </Button>
                        )}
                        {showWriteOff && (
                            <Button
                                variant="secondary"
                                size="sm"
                                title="Owner only: the customer will never pay what's left"
                                onClick={() => setDialog("writeOff")}
                            >
                                <Ban className="w-4 h-4" />
                                Write off
                            </Button>
                        )}
                        {isEnded && !order.restartedAs && (
                            <Button
                                variant="success"
                                size="sm"
                                title="A new order for the same customer, linked to this one"
                                onClick={() => router.push(`/orders/new?restartFrom=${order.code}`)}
                            >
                                <RotateCcw className="w-4 h-4" />
                                Restart
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* ===== Body ===== */}
            <div className="px-4 py-4 sm:px-8 sm:py-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <SectionCard title="Services">
                        <div className="flex flex-wrap gap-2">
                            {order.services.map(({ service }) => (
                                <span key={service.id} className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                                    {service.name}
                                </span>
                            ))}
                        </div>
                    </SectionCard>
                    <SectionCard title="Remarks">
                        <p className="flex items-start gap-2 text-sm text-gray-700 whitespace-pre-line">
                            <StickyNote className="w-4 h-4 shrink-0 mt-0.5 text-primary" />
                            {order.remarks ?? "—"}
                        </p>
                    </SectionCard>
                </div>

                <ContractsSection
                    order={order}
                    contracts={contracts.items}
                    leaveDays={leaveDays}
                    nextContract={nextContract}
                    today={today}
                    footer={
                        <ViewAllLink
                            href={`/orders/${order.code}/contracts`}
                            shown={contracts.items.length}
                            total={contracts.total}
                            label="View all contracts"
                        />
                    }
                />

                <DutySection
                    order={order}
                    duties={duties.items}
                    gaps={gaps}
                    today={today}
                    footer={
                        <ViewAllLink
                            href={`/orders/${order.code}/duty`}
                            shown={duties.items.length}
                            total={duties.total}
                            label="View all staff duty"
                        />
                    }
                />
            </div>

            {/* ===== Actions ===== (only Start care lives here; Edit order is in the header) */}
            {!hasStarted && !isEnded && (
                <div className="flex flex-wrap gap-3 px-4 py-4 sm:px-8 border-t border-gray-200 bg-gray-50">
                    <Button variant="success" onClick={() => setStartingCare(true)}>
                        <Play className="w-4 h-4" />
                        Start care
                    </Button>
                </div>
            )}

            {startingCare && <StartCareDialog orderId={order.id} today={today} onClose={() => setStartingCare(false)} />}
            {dialog === "end" && (
                <EndOrderDialog
                    orderId={order.id}
                    code={order.code}
                    onDuty={onDutyNow ? { name: onDutyNow.staff.name, startDate: onDutyNow.startDate } : null}
                    lastDutyDay={lastDutyDay}
                    today={today}
                    onClose={() => setDialog(null)}
                />
            )}
            {dialog === "undoEnd" && <UndoEndOrderDialog orderId={order.id} code={order.code} onClose={() => setDialog(null)} />}
            {dialog === "writeOff" && order.endDate && (
                <WriteOffOrderDialog
                    orderId={order.id}
                    code={order.code}
                    endDate={order.endDate}
                    owing={owing}
                    onClose={() => setDialog(null)}
                />
            )}
        </div>
    );
}
