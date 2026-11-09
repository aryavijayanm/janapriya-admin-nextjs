import "server-only";

import type { Prisma, Role, StaffEntryType, StaffPaymentMode } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { todayInKerala } from "@/server/domain/age";
import { fromIsoDate, toDayNumber } from "@/server/domain/days";
import { ForbiddenError, NotFoundError, ValidationError } from "@/server/domain/errors";
import {
    calculateDutyEarnings,
    calculateToSettle,
    type SalaryContract,
    type SettledState,
    type ToSettleRow,
} from "@/server/domain/staff-earnings";
import { formatRupees } from "@/lib/money";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import { WRITE_OFF_ROLES, type ClearSalaryInput, type StaffEntryInput } from "@/server/validators/staff-account";

// The staff account (step 3): a passbook per staff member.
//
//   duty    -- worked out live per duty period x contract (never stored)
//   settled -- what each clearing paid per duty x contract (StaffSettledDuty)
//   entries -- PAID (minus) and EXTRA (plus), typed in by hand
//
//   To settle = (duty now - duty settled) + entries not cleared yet + owed from last clearing
//
// "Clear the salary now" pays the To settle total, stores what it paid per
// duty x contract, and stamps the open entries with the clearing (the stamp
// is the lock). Nothing is ever deleted or rewritten: a duty change after a
// clearing simply shows up as To settle again (plus or minus).

type Tx = Prisma.TransactionClient;

/** Everyone may view, add, void and clear (owner's decision). */
const STAFF_ACCOUNT_ROLES: Role[] = [...ALL_ROLES];

/** Cleared periods per page: page 1 = the latest 3. */
const CLEARINGS_PER_PAGE = 3;

function todayDay(): number {
    return toDayNumber(fromIsoDate(todayInKerala()));
}

/** Locks the staff row until the transaction ends, so two clears/entries can't interleave. */
async function lockStaff(tx: Tx, staffId: number) {
    const rows = await tx.$queryRaw<{ id: number }[]>`SELECT id FROM "Staff" WHERE id = ${staffId} FOR UPDATE`;
    if (rows.length === 0) throw new NotFoundError("Staff not found");
}

function assertNotFuture(isoDate: string, label: string) {
    if (toDayNumber(fromIsoDate(isoDate)) > todayDay()) {
        throw new ValidationError(`${label} can't be in the future`);
    }
}

// ---------------------------------------------------------------------------
// To settle (shared by the page and by clearing)
// ---------------------------------------------------------------------------

interface OrderInfo {
    code: string;
    customerName: string;
    branch: string;
}

/**
 * What has been paid so far per duty x contract: the LATEST settled row of
 * each (Postgres DISTINCT ON keeps the first row per key in the ORDER BY,
 * i.e. the newest clearing). Uses the (staffId, dutyId, contractNumber) index.
 */
async function loadSettledState(db: Db | Tx, staffId: number) {
    const rows = await db.$queryRaw<
        (Omit<SettledState, "settledFrom" | "settledTo"> & {
            orderCode: string;
            customerName: string;
            settledFrom: Date | string | null;
            settledTo: Date | string | null;
        })[]
    >`
        SELECT DISTINCT ON ("dutyId", "contractNumber")
               "dutyId", "orderId", "orderCode", "customerName", "contractNumber", "staffSalary",
               "settledFrom", "settledTo", "settledHalfDays", "settledAmount"
          FROM "StaffSettledDuty"
         WHERE "staffId" = ${staffId}
         ORDER BY "dutyId", "contractNumber", "settlementId" DESC, "id" DESC`;
    // DATE columns: normalise to a midnight-UTC Date whichever form the driver gives.
    const asDate = (d: Date | string | null) => (d === null ? null : new Date(d));
    return rows.map((r) => ({ ...r, settledFrom: asDate(r.settledFrom), settledTo: asDate(r.settledTo) }));
}

/**
 * Everything To settle for one staff member: duty differences (all their duty
 * periods, any date -- that's what catches a late or corrected duty), the
 * entries not cleared yet, and what they owed at the last clearing.
 *
 * Counts duty up to TODAY (the account page and clearing), or -- with
 * `estimate` -- up to YESTERDAY, the last day surely known (today's exit may
 * not be entered yet), except days a clearing already paid.
 */
async function loadToSettle(db: Db | Tx, staffId: number, { estimate = false } = {}) {
    const [duties, settled, last, entries] = await Promise.all([
        db.staffAssignment.findMany({
            where: { staffId },
            select: {
                id: true,
                orderId: true,
                startDate: true,
                startDayPart: true,
                endDate: true,
                endDayPart: true,
                order: { select: { code: true, branch: true, customer: { select: { name: true } } } },
            },
        }),
        loadSettledState(db, staffId),
        db.staffSettlement.findFirst({
            where: { staffId },
            orderBy: { id: "desc" },
            select: { clearedOn: true, finalAmount: true },
        }),
        db.staffAccountEntry.findMany({
            where: { staffId, settlementId: null },
            orderBy: [{ entryDate: "asc" }, { id: "asc" }],
            select: ENTRY_SELECT,
        }),
    ]);

    const orderIds = [...new Set([...duties.map((d) => d.orderId), ...settled.map((s) => s.orderId)])];
    const contracts = await db.contract.findMany({
        where: { orderId: { in: orderIds } },
        orderBy: { contractNumber: "asc" },
        select: { orderId: true, contractNumber: true, startDate: true, endDate: true, staffSalary: true },
    });
    const contractsByOrder = new Map<number, SalaryContract[]>();
    for (const c of contracts) {
        const list = contractsByOrder.get(c.orderId) ?? [];
        list.push(c);
        contractsByOrder.set(c.orderId, list);
    }

    // Order names: from the live duty; for a duty no longer this staff's
    // (moved to someone else), from the copy kept on the settled row.
    const orders = new Map<number, OrderInfo>();
    for (const s of settled) orders.set(s.orderId, { code: s.orderCode, customerName: s.customerName, branch: "" });
    for (const d of duties) {
        orders.set(d.orderId, { code: d.order.code, customerName: d.order.customer.name, branch: d.order.branch });
    }
    const missingBranch = [...orders.entries()].filter(([, o]) => o.branch === "").map(([id]) => id);
    if (missingBranch.length > 0) {
        const found = await db.customerOrder.findMany({ where: { id: { in: missingBranch } }, select: { id: true, branch: true } });
        for (const o of found) orders.get(o.id)!.branch = o.branch;
    }

    // Estimate only: the last day each duty was paid up to, so it still counts.
    let paidUpto: Map<number, number> | undefined;
    if (estimate) {
        paidUpto = new Map();
        for (const s of settled) {
            if (!s.settledTo) continue;
            const day = toDayNumber(s.settledTo);
            paidUpto.set(s.dutyId, Math.max(day, paidUpto.get(s.dutyId) ?? day));
        }
    }
    const now = calculateDutyEarnings(
        duties.map((d) => ({ ...d, dutyId: d.id })),
        contractsByOrder,
        estimate ? todayDay() - 1 : todayDay(),
        paidUpto,
    );
    const rows = calculateToSettle(now, settled);
    const carried = last && last.finalAmount < 0 ? last.finalAmount : 0;
    const earned = rows.reduce((sum, r) => sum + r.amount, 0);
    const { extras, recovered, paid } = entryTotals(entries);

    return {
        rows,
        orders,
        entries,
        carried,
        earned,
        extras,
        recovered,
        paid,
        balance: carried + earned + extras + recovered - paid,
        lastClearedOn: last?.clearedOn ?? null,
    };
}

/**
 * The balance for the staff balances list: the same calculation as the
 * account page, counted until yesterday (see loadToSettle). Look-up only --
 * paying always goes through the account page.
 */
export async function estimateStaffBalance(db: Db, staffId: number): Promise<number> {
    return (await loadToSettle(db, staffId, { estimate: true })).balance;
}

/**
 * Totals of a set of entries (voided ones never count):
 *   extras    -- EXTRA (earnings added)
 *   recovered -- RECEIVED + WRITE_OFF (what the staff owed, paid back or forgiven)
 *   paid      -- PAID, as a positive number
 */
function entryTotals(entries: { type: StaffEntryType; amount: number; voidedAt: Date | null }[]) {
    let extras = 0;
    let recovered = 0;
    let paid = 0;
    for (const e of entries) {
        if (e.voidedAt !== null) continue;
        if (e.type === "PAID") paid += -e.amount;
        else if (e.type === "EXTRA") extras += e.amount;
        else recovered += e.amount;
    }
    return { extras, recovered, paid };
}

/** Only the Owner may forgive money -- adding or voiding a WRITE_OFF. */
function assertMayWriteOff(user: AuthUser) {
    if (!(WRITE_OFF_ROLES as readonly Role[]).includes(user.role)) {
        throw new ForbiddenError("Only the owner can write off an amount from staff");
    }
}

// ---------------------------------------------------------------------------
// Reading: the passbook
// ---------------------------------------------------------------------------

const ENTRY_SELECT = {
    id: true,
    type: true,
    amount: true,
    entryDate: true,
    remarks: true,
    mode: true,
    accountDetails: true,
    voidedAt: true,
    voidReason: true,
    settlementId: true,
    createdAt: true,
    recordedBy: { select: { name: true } },
    voidedBy: { select: { name: true } },
} satisfies Prisma.StaffAccountEntrySelect;

export type StaffEntryView = Prisma.StaffAccountEntryGetPayload<{ select: typeof ENTRY_SELECT }>;

/** One duty line of the passbook: Settled (in a clearing) or To settle. */
export interface DutyRowView {
    /** Unique within the page, for React keys. */
    key: string;
    /** null = hidden from this user ("Another order"). */
    orderCode: string | null;
    customerName: string | null;
    contractNumber: number;
    staffSalary: number;
    fromDate: Date;
    toDate: Date;
    /** Days x 2; minus = days paid before that are no longer worked. */
    halfDays: number;
    amount: number;
}

export interface ClearedPeriodView {
    id: number;
    clearedOn: Date;
    createdAt: Date;
    clearedBy: string | null;
    /** Owed from the clearing before (minus = the staff owed this). */
    carried: number;
    earned: number;
    extras: number;
    recovered: number;
    paid: number;
    finalAmount: number;
    rows: DutyRowView[];
    entries: StaffEntryView[];
}

export interface StaffAccount {
    staff: { id: number; name: string; place: string };
    toSettle: {
        carried: number;
        rows: DutyRowView[];
        entries: StaffEntryView[];
        earned: number;
        extras: number;
        recovered: number;
        paid: number;
        balance: number;
        lastClearedOn: Date | null;
    };
    /** This user may add/void a Write off (Owner only). */
    canWriteOff: boolean;
    cleared: ClearedPeriodView[];
    page: number;
    totalPages: number;
}

/** OUTSIDER never sees an OUTSIDE order: the amount counts, the order is hidden. */
function dutyRowView(
    user: AuthUser,
    key: string,
    order: OrderInfo | undefined,
    row: { contractNumber: number; staffSalary: number; fromDate: Date; toDate: Date; halfDays: number; amount: number },
): DutyRowView {
    const hidden = !order || (user.role === "OUTSIDER" && order.branch === "OUTSIDE");
    return {
        key,
        orderCode: hidden ? null : order.code,
        customerName: hidden ? null : order.customerName,
        contractNumber: row.contractNumber,
        staffSalary: row.staffSalary,
        fromDate: row.fromDate,
        toDate: row.toDate,
        halfDays: row.halfDays,
        amount: row.amount,
    };
}

/** The staff account: one page of clearings (latest 3 first) + To settle. */
export async function getStaffAccount(db: Db, user: AuthUser, staffId: number, page = 1): Promise<StaffAccount | null> {
    assertRole(user, STAFF_ACCOUNT_ROLES);

    const staff = await db.staff.findUnique({ where: { id: staffId }, select: { id: true, name: true, place: true } });
    if (!staff) return null;

    const open = await loadToSettle(db, staffId);

    // --- one page of cleared periods (newest first; id = the order they happened in) ---
    const totalClearings = await db.staffSettlement.count({ where: { staffId } });
    const totalPages = Math.max(1, Math.ceil(totalClearings / CLEARINGS_PER_PAGE));
    const current = Math.min(Math.max(1, page), totalPages);
    const settlements = await db.staffSettlement.findMany({
        where: { staffId },
        orderBy: { id: "desc" },
        skip: (current - 1) * CLEARINGS_PER_PAGE,
        // One extra (older) clearing, to know what the oldest shown one carried in.
        take: CLEARINGS_PER_PAGE + 1,
        include: {
            clearedBy: { select: { name: true } },
            settledDuty: { orderBy: [{ fromDate: "asc" }, { id: "asc" }] },
            entries: { orderBy: [{ entryDate: "asc" }, { id: "asc" }], select: ENTRY_SELECT },
        },
    });

    // Branches of the orders in the shown clearings (for the OUTSIDER rule).
    const shown = settlements.slice(0, CLEARINGS_PER_PAGE);
    const settledOrderIds = [...new Set(shown.flatMap((s) => s.settledDuty.map((d) => d.orderId)))];
    const branches = new Map(
        (await db.customerOrder.findMany({ where: { id: { in: settledOrderIds } }, select: { id: true, branch: true } })).map(
            (o) => [o.id, o.branch],
        ),
    );

    const cleared: ClearedPeriodView[] = shown.map((s, i) => ({
        id: s.id,
        clearedOn: s.clearedOn,
        createdAt: s.createdAt,
        clearedBy: s.clearedBy?.name ?? null,
        carried: Math.min(0, settlements[i + 1]?.finalAmount ?? 0),
        earned: s.earned,
        extras: s.extras,
        recovered: s.recovered,
        paid: s.paid,
        finalAmount: s.finalAmount,
        rows: s.settledDuty.map((d) =>
            dutyRowView(
                user,
                `s${d.id}`,
                { code: d.orderCode, customerName: d.customerName, branch: branches.get(d.orderId) ?? "KERALA" },
                d,
            ),
        ),
        entries: s.entries,
    }));

    return {
        staff,
        toSettle: {
            carried: open.carried,
            rows: open.rows.map((r) => dutyRowView(user, `t${r.dutyId}-${r.contractNumber}`, open.orders.get(r.orderId), r)),
            entries: open.entries,
            earned: open.earned,
            extras: open.extras,
            recovered: open.recovered,
            paid: open.paid,
            balance: open.balance,
            lastClearedOn: open.lastClearedOn,
        },
        canWriteOff: (WRITE_OFF_ROLES as readonly Role[]).includes(user.role),
        cleared,
        page: current,
        totalPages,
    };
}

// ---------------------------------------------------------------------------
// Changing: add, void, clear
// ---------------------------------------------------------------------------

/**
 * "+ Add entry": PAID (stored minus), EXTRA, RECEIVED or WRITE_OFF (stored plus).
 *
 * RECEIVED and WRITE_OFF only close a debt: allowed while the staff owes, and
 * at most what they owe -- so a typo (₹20,000 for ₹2,000) can never turn into
 * money the agency "owes" and pays out. Checked against the LIVE balance
 * (until today, as on the account page), inside the staff lock, so two tabs
 * can't both use the same debt.
 */
export async function addStaffEntry(db: Db, user: AuthUser, staffId: number, input: StaffEntryInput): Promise<void> {
    assertRole(user, STAFF_ACCOUNT_ROLES);
    if (input.type === "WRITE_OFF") assertMayWriteOff(user);
    assertNotFuture(input.entryDate, input.type === "PAID" ? "The date of pay" : "The date");
    const closesDebt = input.type === "RECEIVED" || input.type === "WRITE_OFF";
    const movesMoney = input.type === "PAID" || input.type === "RECEIVED";

    await db.$transaction(async (tx) => {
        await lockStaff(tx, staffId);

        if (closesDebt) {
            const owes = -(await loadToSettle(tx, staffId)).balance;
            if (owes <= 0) {
                throw new ValidationError("There is no amount from staff right now.");
            }
            if (input.amount > owes) {
                throw new ValidationError(`Amount from staff is only ${formatRupees(owes)}. Please check the amount.`);
            }
        }

        await tx.staffAccountEntry.create({
            data: {
                staffId,
                type: input.type,
                amount: input.type === "PAID" ? -input.amount : input.amount,
                entryDate: fromIsoDate(input.entryDate),
                remarks: input.remarks,
                mode: movesMoney ? (input.mode as StaffPaymentMode) : null,
                accountDetails: movesMoney ? input.accountDetails : null,
                recordedById: user.id,
            },
        });
    });
}

/** Cancels a wrong entry -- only while it hasn't been cleared. It stays, crossed out. */
export async function voidStaffEntry(db: Db, user: AuthUser, entryId: number, reason: string): Promise<{ staffId: number }> {
    assertRole(user, STAFF_ACCOUNT_ROLES);

    return db.$transaction(async (tx) => {
        const entry = await tx.staffAccountEntry.findUnique({
            where: { id: entryId },
            select: { staffId: true, type: true, voidedAt: true, settlementId: true },
        });
        if (!entry) throw new NotFoundError("Entry not found");
        // Undoing a write off would un-forgive the debt: the owner's decision too.
        if (entry.type === "WRITE_OFF") assertMayWriteOff(user);
        await lockStaff(tx, entry.staffId);
        if (entry.settlementId !== null) {
            throw new ValidationError("This entry is part of a cleared salary and can't be changed. Adjust it in the next payment.");
        }
        if (entry.voidedAt !== null) throw new ValidationError("This entry is already voided");

        await tx.staffAccountEntry.update({
            where: { id: entryId },
            data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason },
        });
        return { staffId: entry.staffId };
    });
}

/** A To settle row as stored by the clearing: what it paid now + the running state. */
function settledDutyData(staffId: number, row: ToSettleRow, order: OrderInfo | undefined) {
    if (!order) throw new Error(`Order ${row.orderId} not found for duty ${row.dutyId}`);
    return {
        staffId,
        dutyId: row.dutyId,
        orderId: row.orderId,
        orderCode: order.code,
        customerName: order.customerName,
        contractNumber: row.contractNumber,
        staffSalary: row.staffSalary,
        fromDate: row.fromDate,
        toDate: row.toDate,
        halfDays: row.halfDays,
        amount: row.amount,
        ...row.after,
    };
}

/**
 * "Clear the salary now": in ONE transaction -- recalculates To settle,
 * stores the clearing with what it paid per duty x contract, stamps every
 * open entry with it (the lock), and records the final payment (if anything
 * is owed to the staff). Never undone.
 */
export async function clearStaffSalary(
    db: Db,
    user: AuthUser,
    staffId: number,
    input: ClearSalaryInput,
): Promise<{ finalAmount: number }> {
    assertRole(user, STAFF_ACCOUNT_ROLES);
    if (input.payment) assertNotFuture(input.payment.paidOn, "The date of pay");

    return db.$transaction(async (tx) => {
        await lockStaff(tx, staffId);

        const open = await loadToSettle(tx, staffId);
        const finalAmount = open.balance;

        // Only something NEW (a duty difference or an entry) is worth a clearing.
        // An owed amount carried in on its own would just be carried again,
        // adding an empty CLEARED line -- it waits for the next earning instead.
        if (open.rows.length === 0 && open.entries.length === 0) {
            throw new ValidationError(
                open.carried < 0
                    ? `Nothing new to settle. The amount from staff (${formatRupees(-open.carried)}) comes off their next earnings.`
                    : "There is nothing to settle",
            );
        }
        // Something changed between opening the dialog and saving (another tab,
        // a duty edit): never lock a figure nobody looked at.
        if (finalAmount !== input.expectedFinalAmount) {
            throw new ValidationError(
                `The amounts changed while you were clearing (now ${formatRupees(finalAmount)}). Close this and check again.`,
            );
        }
        if (finalAmount > 0 && !input.payment) {
            throw new ValidationError("Please enter how and when the final amount is paid");
        }

        const settlement = await tx.staffSettlement.create({
            data: {
                staffId,
                clearedOn: fromIsoDate(todayInKerala()),
                earned: open.earned,
                extras: open.extras,
                recovered: open.recovered,
                paid: open.paid,
                finalAmount,
                clearedById: user.id,
                settledDuty: {
                    create: open.rows.map((r) => settledDutyData(staffId, r, open.orders.get(r.orderId))),
                },
            },
        });

        // Stamp the open entries first, then add the final payment already stamped.
        await tx.staffAccountEntry.updateMany({
            where: { staffId, settlementId: null },
            data: { settlementId: settlement.id },
        });
        if (finalAmount > 0 && input.payment) {
            await tx.staffAccountEntry.create({
                data: {
                    staffId,
                    type: "PAID",
                    amount: -finalAmount,
                    entryDate: fromIsoDate(input.payment.paidOn),
                    remarks: input.payment.remarks,
                    mode: input.payment.mode,
                    accountDetails: input.payment.accountDetails,
                    recordedById: user.id,
                    settlementId: settlement.id,
                },
            });
        }
        return { finalAmount };
    });
}
