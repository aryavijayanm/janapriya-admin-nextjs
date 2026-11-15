"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Ban, ChevronRight, CircleStop, OctagonX, PlayCircle, RefreshCw, UserCheck, UserMinus, type LucideIcon } from "lucide-react";
import { formatRupees } from "@/lib/money";
import { DAY_PART_LABELS } from "@/server/validators/order";
import type { OrderActivity, OrderActivityKind, StaffActivity, StaffActivityKind } from "@/server/services/activities.service";

/** One line: icon, text, optional note, and the whole line is a link. */
function Line({ href, icon: Icon, tone, children, note }: { href: string; icon: LucideIcon; tone: string; children: ReactNode; note?: string | null }) {
    return (
        <li>
            <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                    <Icon className="w-4 h-4" />
                </span>
                <span className="min-w-0 flex-1">
                    <span className="block text-sm text-gray-900">{children}</span>
                    {note && <span className="block text-xs text-gray-500 wrap-break-word">“{note}”</span>}
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-gray-400" />
            </Link>
        </li>
    );
}

function List({ empty, children }: { empty: string; children: ReactNode[] }) {
    if (children.length === 0) return <p className="py-8 text-center text-sm text-gray-400">{empty}</p>;
    return <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">{children}</ul>;
}

const Name = ({ children }: { children: ReactNode }) => <span className="font-semibold">{children}</span>;
const Code = ({ children }: { children: ReactNode }) => <span className="font-mono font-semibold">{children}</span>;

const ORDER_STYLE: Record<OrderActivityKind, { icon: LucideIcon; tone: string }> = {
    CARE_STARTED: { icon: PlayCircle, tone: "bg-green-100 text-green-700" },
    CONTRACT_STARTED: { icon: RefreshCw, tone: "bg-blue-100 text-blue-700" },
    CONTRACT_ENDED: { icon: CircleStop, tone: "bg-amber-100 text-amber-700" },
    ORDER_ENDED: { icon: OctagonX, tone: "bg-red-100 text-red-700" },
    WRITTEN_OFF: { icon: Ban, tone: "bg-gray-200 text-gray-700" },
};

/** Order activities: each line opens the order page. `future` = the day is after today. */
export function OrderActivityList({ items, future }: { items: OrderActivity[]; future: boolean }) {
    return (
        <List empty="No order activities on this day.">
            {items.map((a) => {
                const who = (
                    <>
                        <Name>{a.customerName}</Name> · <Code>{a.orderCode}</Code>
                    </>
                );
                const text: Record<OrderActivityKind, ReactNode> = {
                    CARE_STARTED: (
                        <>
                            Care started: {who}
                            {a.restartedFrom && <span className="text-gray-500"> (restarted from {a.restartedFrom})</span>}
                        </>
                    ),
                    CONTRACT_STARTED: (
                        <>
                            Contract #{a.contractNumber} started: {who}
                        </>
                    ),
                    // A future end is the expected date: it moves if duty changes.
                    CONTRACT_ENDED: (
                        <>
                            Contract #{a.contractNumber} {future ? "expected to end" : "ended"}: {who}
                        </>
                    ),
                    ORDER_ENDED: <>Order ended: {who}</>,
                    WRITTEN_OFF: (
                        <>
                            Written off {formatRupees(a.amount ?? 0)}: {who}
                        </>
                    ),
                };
                return (
                    <Line key={a.key} href={`/orders/${a.orderCode}`} {...ORDER_STYLE[a.kind]} note={a.note}>
                        {text[a.kind]}
                    </Line>
                );
            })}
        </List>
    );
}

const STAFF_STYLE: Record<StaffActivityKind, { icon: LucideIcon; tone: string }> = {
    DUTY_STARTED: { icon: UserCheck, tone: "bg-green-100 text-green-700" },
    DUTY_ENDED: { icon: UserMinus, tone: "bg-amber-100 text-amber-700" },
    WRITE_OFF: { icon: Ban, tone: "bg-gray-200 text-gray-700" },
};

/** Staffs activities: each line opens the staff member's page. */
export function StaffActivityList({ items }: { items: StaffActivity[] }) {
    return (
        <List empty="No staff activities on this day.">
            {items.map((a) => {
                const withWhom = (
                    <>
                        <Name>{a.customerName}</Name> · <Code>{a.orderCode}</Code>
                        {a.dayPart && <span className="text-gray-500"> ({DAY_PART_LABELS[a.dayPart]})</span>}
                    </>
                );
                const text: Record<StaffActivityKind, ReactNode> = {
                    DUTY_STARTED: (
                        <>
                            <Name>{a.staffName}</Name> started duty with {withWhom}
                        </>
                    ),
                    DUTY_ENDED: (
                        <>
                            <Name>{a.staffName}</Name> ended duty with {withWhom}
                        </>
                    ),
                    WRITE_OFF: (
                        <>
                            Salary write off {formatRupees(a.amount ?? 0)} for <Name>{a.staffName}</Name>
                        </>
                    ),
                };
                return (
                    <Line key={a.key} href={`/staff/${a.staffId}`} {...STAFF_STYLE[a.kind]} note={a.note}>
                        {text[a.kind]}
                    </Line>
                );
            })}
        </List>
    );
}
