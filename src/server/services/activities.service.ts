import "server-only";

import type { DayPart, Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { fromIsoDate } from "@/server/domain/days";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import { visibleOrders } from "@/server/services/order.service";
import { getAccountDay, type AccountDay } from "@/server/services/account-book.service";

// What happened on one day -- past, today or future.
//
// Nothing is worked out here: every date is already STORED (contract start /
// end, duty start / end, order end, write-off dates), and each has an index.
// So a day is a handful of "WHERE date = that day" lookups -- the same speed
// for any day, however many orders the business has. A contract's end date
// is re-saved whenever duty changes, so a future day shows the latest
// expected end.
//
// Always the real dates (startDate / endDate / writtenOffOn), never createdAt:
// the office often enters things days later (owner's decision).

/** Everyone may view; the order branch rule still applies (visibleOrders). */
const ACTIVITY_ROLES: Role[] = [...ALL_ROLES];
/** Money transactions: same people as the accounts book. */
const MONEY_ROLES: Role[] = ["OWNER", "STAFF"];

export type OrderActivityKind = "CARE_STARTED" | "CONTRACT_STARTED" | "CONTRACT_ENDED" | "ORDER_ENDED" | "WRITTEN_OFF";

export interface OrderActivity {
    /** Unique within the list (React key). */
    key: string;
    kind: OrderActivityKind;
    orderCode: string;
    customerName: string;
    contractNumber: number | null;
    /** CARE_STARTED of a restarted order: the order it continues. */
    restartedFrom: string | null;
    /** End note / write-off reason. */
    note: string | null;
    /** WRITTEN_OFF only. */
    amount: number | null;
}

export type StaffActivityKind = "DUTY_STARTED" | "DUTY_ENDED" | "WRITE_OFF";

export interface StaffActivity {
    key: string;
    kind: StaffActivityKind;
    staffId: number;
    staffName: string;
    /** Duty rows only. */
    orderCode: string | null;
    customerName: string | null;
    dayPart: DayPart | null;
    /** Stop note / write-off remarks. */
    note: string | null;
    /** WRITE_OFF only. */
    amount: number | null;
}

export interface DayActivities {
    orders: OrderActivity[];
    staff: StaffActivity[];
    /** null = this user doesn't see money (OUTSIDER). */
    money: AccountDay | null;
}

const ORDER_KIND_ORDER: OrderActivityKind[] = ["CARE_STARTED", "CONTRACT_STARTED", "CONTRACT_ENDED", "ORDER_ENDED", "WRITTEN_OFF"];
const STAFF_KIND_ORDER: StaffActivityKind[] = ["DUTY_STARTED", "DUTY_ENDED", "WRITE_OFF"];

/** Everything on one day (yyyy-mm-dd), grouped by tab. */
export async function getDayActivities(db: Db, user: AuthUser, day: string): Promise<DayActivities> {
    assertRole(user, ACTIVITY_ROLES);
    const date = fromIsoDate(day);
    // OUTSIDER: no OUTSIDE-branch orders, and nothing about their contracts or duty.
    const order = visibleOrders(user);
    const customer = { select: { name: true } };

    const [contracts, endedOrders, writeOffs, duties, staffWriteOffs, money] = await Promise.all([
        db.contract.findMany({
            where: { OR: [{ startDate: date }, { endDate: date }], order },
            select: {
                id: true,
                contractNumber: true,
                startDate: true,
                endDate: true,
                order: { select: { code: true, customer, restartedFrom: { select: { code: true } } } },
            },
        }),
        db.customerOrder.findMany({
            where: { endDate: date, ...order },
            select: { id: true, code: true, endNote: true, customer },
        }),
        db.orderWriteOff.findMany({
            where: { writtenOffOn: date, order },
            select: { id: true, amount: true, reason: true, order: { select: { code: true, customer } } },
        }),
        db.staffAssignment.findMany({
            where: { OR: [{ startDate: date }, { endDate: date }], order },
            select: {
                id: true,
                startDate: true,
                startDayPart: true,
                endDate: true,
                endDayPart: true,
                endNote: true,
                staff: { select: { id: true, name: true } },
                order: { select: { code: true, customer } },
            },
        }),
        db.staffAccountEntry.findMany({
            where: { type: "WRITE_OFF", entryDate: date, voidedAt: null },
            select: { id: true, amount: true, remarks: true, staff: { select: { id: true, name: true } } },
        }),
        MONEY_ROLES.includes(user.role) ? getAccountDay(db, user, day) : Promise.resolve(null),
    ]);

    const sameDay = (d: Date | null) => d !== null && d.getTime() === date.getTime();

    const orders: OrderActivity[] = [];
    for (const c of contracts) {
        const base = {
            orderCode: c.order.code,
            customerName: c.order.customer.name,
            contractNumber: c.contractNumber,
            restartedFrom: null,
            note: null,
            amount: null,
        };
        if (sameDay(c.startDate)) {
            // Contract #1 starting = care starting (shown once, not twice).
            orders.push(
                c.contractNumber === 1
                    ? { ...base, key: `start-${c.id}`, kind: "CARE_STARTED", restartedFrom: c.order.restartedFrom?.code ?? null }
                    : { ...base, key: `start-${c.id}`, kind: "CONTRACT_STARTED" },
            );
        }
        if (sameDay(c.endDate)) orders.push({ ...base, key: `end-${c.id}`, kind: "CONTRACT_ENDED" });
    }
    for (const o of endedOrders) {
        orders.push({
            key: `order-end-${o.id}`,
            kind: "ORDER_ENDED",
            orderCode: o.code,
            customerName: o.customer.name,
            contractNumber: null,
            restartedFrom: null,
            note: o.endNote,
            amount: null,
        });
    }
    for (const w of writeOffs) {
        orders.push({
            key: `write-off-${w.id}`,
            kind: "WRITTEN_OFF",
            orderCode: w.order.code,
            customerName: w.order.customer.name,
            contractNumber: null,
            restartedFrom: null,
            note: w.reason,
            amount: w.amount,
        });
    }

    const staff: StaffActivity[] = [];
    for (const d of duties) {
        const base = {
            staffId: d.staff.id,
            staffName: d.staff.name,
            orderCode: d.order.code,
            customerName: d.order.customer.name,
            amount: null,
        };
        if (sameDay(d.startDate)) {
            staff.push({ ...base, key: `duty-start-${d.id}`, kind: "DUTY_STARTED", dayPart: d.startDayPart, note: null });
        }
        if (sameDay(d.endDate)) {
            staff.push({ ...base, key: `duty-end-${d.id}`, kind: "DUTY_ENDED", dayPart: d.endDayPart, note: d.endNote });
        }
    }
    for (const e of staffWriteOffs) {
        staff.push({
            key: `staff-write-off-${e.id}`,
            kind: "WRITE_OFF",
            staffId: e.staff.id,
            staffName: e.staff.name,
            orderCode: null,
            customerName: null,
            dayPart: null,
            note: e.remarks,
            amount: e.amount,
        });
    }

    // Grouped by kind (starts first, then ends, then write-offs), then by name.
    orders.sort(
        (a, b) =>
            ORDER_KIND_ORDER.indexOf(a.kind) - ORDER_KIND_ORDER.indexOf(b.kind) || a.customerName.localeCompare(b.customerName),
    );
    staff.sort(
        (a, b) => STAFF_KIND_ORDER.indexOf(a.kind) - STAFF_KIND_ORDER.indexOf(b.kind) || a.staffName.localeCompare(b.staffName),
    );

    return { orders, staff, money };
}

export interface DayActivityCounts {
    orders: number;
    staff: number;
    /** null = this user doesn't see money. */
    money: number | null;
}

/** The dashboard card: how many lines each tab has today. A day is small, so it's simply counted. */
export async function getDayActivityCounts(db: Db, user: AuthUser, day: string): Promise<DayActivityCounts> {
    const { orders, staff, money } = await getDayActivities(db, user, day);
    return { orders: orders.length, staff: staff.length, money: money ? money.rows.length : null };
}
