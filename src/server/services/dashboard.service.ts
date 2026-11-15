import "server-only";

import type { Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { assertRole, type AuthUser } from "@/server/services/authz";

/** The four small boxes at the top of the dashboard are the Owner's only. */
const OWNER_TOTALS_ROLES: Role[] = ["OWNER"];

export interface OwnerTotals {
    /** Active + disabled customers (deleted ones left out). */
    customers: number;
    /** Active + disabled staff (deleted ones left out). */
    staff: number;
    /** Orders still running (not ended yet). */
    activeOrders: number;
    /** Every order ever created, running or ended. */
    allOrders: number;
}

/**
 * The Owner's four headline numbers: four plain counts, run at the same time.
 * Even at 5,000 customers and years of orders a count like this is a few
 * milliseconds -- no stored copies needed.
 */
export async function getOwnerTotals(db: Db, user: AuthUser): Promise<OwnerTotals> {
    assertRole(user, OWNER_TOTALS_ROLES);
    const [customers, staff, activeOrders, allOrders] = await Promise.all([
        db.customer.count({ where: { status: { not: "DELETED" } } }),
        db.staff.count({ where: { status: { not: "DELETED" } } }),
        // endDate is set by End order; null = still running (indexed).
        db.customerOrder.count({ where: { endDate: null } }),
        db.customerOrder.count(),
    ]);
    return { customers, staff, activeOrders, allOrders };
}
