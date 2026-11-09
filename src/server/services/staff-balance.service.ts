import "server-only";

import type { Prisma, Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { paginate, type PaginatedResult } from "@/server/db/paginate";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import { estimateStaffBalance } from "@/server/services/staff-account.service";
import { staffSearchWhere } from "@/server/services/staff.service";
import type { StaffBalanceQuery } from "@/server/validators/staff-balance";

// Staff balances: a FAST LOOK-UP of who we owe and who owes us, across all
// staff (thousands over the years). Never used for paying -- the staff
// account page calculates live and is the only place money is settled.
//
// Staff.balanceDue is a stored copy of each account's balance, estimated
// until yesterday. Kept fresh in two ways:
//   1. after a save that changes someone's money -> only those staff
//   2. the nightly job -> everyone, in batches (also heals anything missed)
// The list and the dashboard card only READ it, so they stay instant at any size.

/** Everyone may view the list (owner's decision). */
const STAFF_BALANCE_ROLES: Role[] = [...ALL_ROLES];
/** The money totals on the dashboard card. */
const BALANCE_TOTALS_ROLES: Role[] = ["OWNER"];

const PAGE_SIZE = 25;
/** Staff per batch in the nightly refresh: bounded memory at any number of staff. */
const REFRESH_BATCH = 100;

// ---------------------------------------------------------------------------
// Keeping balanceDue fresh
// ---------------------------------------------------------------------------

/**
 * Recalculates balanceDue for these staff (same calculation as the account
 * page, until yesterday). Returns how many changed.
 *
 * Written with plain SQL on purpose: a Prisma update would also bump the
 * staff's updated_at, making every staff member look "edited" each night.
 * "<>" skips rows whose balance didn't change, so most nights only staff on
 * duty are written.
 */
export async function refreshStaffBalances(db: Db, staffIds: Iterable<number>): Promise<number> {
    let changed = 0;
    for (const staffId of new Set(staffIds)) {
        const balance = await estimateStaffBalance(db, staffId);
        changed += await db.$executeRaw`
            UPDATE "Staff" SET "balanceDue" = ${balance} WHERE id = ${staffId} AND "balanceDue" <> ${balance}`;
    }
    return changed;
}

/** Every staff member who has worked on this order (now, before, or paid for it). */
async function staffIdsOfOrder(db: Db, orderId: number): Promise<number[]> {
    const [duties, settled] = await Promise.all([
        db.staffAssignment.findMany({ where: { orderId }, distinct: ["staffId"], select: { staffId: true } }),
        db.staffSettledDuty.findMany({ where: { orderId }, distinct: ["staffId"], select: { staffId: true } }),
    ]);
    return [...duties, ...settled].map((r) => r.staffId);
}

/**
 * Runs an order change (duty or contract) and then refreshes the balances
 * of the staff on that order. Staff are collected BEFORE and AFTER, because
 * an edit can move a duty from one staff member to another -- both change.
 *
 * A failed refresh never fails the user's save: the save is already done,
 * and the nightly job corrects the look-up figure by the next morning.
 */
export async function withStaffBalanceRefresh<T>(
    db: Db,
    ref: { orderId: number } | { contractId: number },
    run: () => Promise<T>,
): Promise<T> {
    const orderId =
        "orderId" in ref
            ? ref.orderId
            : ((await db.contract.findUnique({ where: { id: ref.contractId }, select: { orderId: true } }))?.orderId ?? null);
    const before = orderId === null ? [] : await staffIdsOfOrder(db, orderId);

    const result = await run();

    if (orderId !== null) {
        try {
            await refreshStaffBalances(db, [...before, ...(await staffIdsOfOrder(db, orderId))]);
        } catch (error) {
            console.error(`Staff balances: refresh after a change to order ${orderId} failed (nightly job will fix it):`, error);
        }
    }
    return result;
}

/** Same, for a change on one staff member's account (entry, void, clearing). */
export async function refreshStaffBalanceQuietly(db: Db, staffId: number): Promise<void> {
    try {
        await refreshStaffBalances(db, [staffId]);
    } catch (error) {
        console.error(`Staff balances: refresh for staff ${staffId} failed (nightly job will fix it):`, error);
    }
}

/**
 * The nightly refresh: every staff member, 100 at a time (walking by id, so
 * memory stays the same at 2,000 or 20,000 staff). Covers the day just
 * earned by staff on duty, and heals any refresh a save missed.
 */
export async function refreshAllStaffBalances(db: Db): Promise<{ checked: number; changed: number }> {
    let checked = 0;
    let changed = 0;
    let afterId = 0;
    for (;;) {
        const batch = await db.staff.findMany({
            where: { id: { gt: afterId } },
            orderBy: { id: "asc" },
            take: REFRESH_BATCH,
            select: { id: true },
        });
        if (batch.length === 0) break;
        const ids = batch.map((s) => s.id);
        changed += await refreshStaffBalances(db, ids);
        checked += ids.length;
        afterId = ids[ids.length - 1];
    }
    return { checked, changed };
}

// ---------------------------------------------------------------------------
// Reading: the list and the dashboard totals (stored values only)
// ---------------------------------------------------------------------------

export interface StaffBalanceRow {
    id: number;
    name: string;
    place: string;
    status: string;
    onDuty: boolean;
    /** + owed to the staff, - the staff owes. */
    balanceDue: number;
}

/** One page of staff whose balance isn't zero, with the money/duty filters and search. */
export async function listStaffBalances(
    db: Db,
    user: AuthUser,
    query: StaffBalanceQuery,
): Promise<PaginatedResult<StaffBalanceRow>> {
    assertRole(user, STAFF_BALANCE_ROLES);
    const { page, money, duty, search } = query;

    // Deleted staff are included on purpose: money they're owed (or owe)
    // doesn't disappear with them.
    const where: Prisma.StaffWhereInput = {
        balanceDue: money === "owed" ? { gt: 0 } : money === "owes" ? { lt: 0 } : { not: 0 },
        ...(duty === "on" ? { duties: { some: { endDate: null } } } : {}),
        ...(duty === "off" ? { duties: { none: { endDate: null } } } : {}),
        ...(search ? staffSearchWhere(search) : {}),
    };
    // Biggest amounts first when looking at one direction; by name otherwise.
    // id as tie-breaker so pages never overlap.
    const orderBy: Prisma.StaffOrderByWithRelationInput[] =
        money === "owed"
            ? [{ balanceDue: "desc" }, { id: "asc" }]
            : money === "owes"
              ? [{ balanceDue: "asc" }, { id: "asc" }]
              : [{ name: "asc" }, { id: "asc" }];

    const result = await paginate(
        () => db.staff.count({ where }),
        (skip, take) =>
            db.staff.findMany({
                where,
                orderBy,
                skip,
                take,
                select: {
                    id: true,
                    name: true,
                    place: true,
                    status: true,
                    balanceDue: true,
                    duties: { where: { endDate: null }, select: { id: true }, take: 1 },
                },
            }),
        page,
        PAGE_SIZE,
    );
    return {
        pagination: result.pagination,
        data: result.data.map(({ duties, ...s }) => ({ ...s, onDuty: duties.length > 0 })),
    };
}

export interface StaffBalanceTotals {
    owedToStaff: { amount: number; staff: number };
    staffOwes: { amount: number; staff: number };
}

/** The dashboard card's totals (Owner only): two sums over the stored column. */
export async function getStaffBalanceTotals(db: Db, user: AuthUser): Promise<StaffBalanceTotals> {
    assertRole(user, BALANCE_TOTALS_ROLES);
    const [owed, owes] = await Promise.all([
        db.staff.aggregate({ where: { balanceDue: { gt: 0 } }, _sum: { balanceDue: true }, _count: true }),
        db.staff.aggregate({ where: { balanceDue: { lt: 0 } }, _sum: { balanceDue: true }, _count: true }),
    ]);
    return {
        owedToStaff: { amount: owed._sum.balanceDue ?? 0, staff: owed._count },
        staffOwes: { amount: -(owes._sum.balanceDue ?? 0), staff: owes._count },
    };
}
