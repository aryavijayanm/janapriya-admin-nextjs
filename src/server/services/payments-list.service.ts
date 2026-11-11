import "server-only";

import { Prisma, type Branch, type PaymentMode, type PaymentStatus, type Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { escapeLike } from "@/server/db/like";
import type { PaginatedResult } from "@/server/db/paginate";
import { contractsToShow } from "@/server/domain/payments-list";
import { balanceDue, contractAmountDue, refundDue } from "@/server/domain/payments";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import { parseCustomerCode } from "@/server/validators/customer";
import type { PaymentsFilter, PaymentsListQuery } from "@/server/validators/payments-list";

// The payments table: which customers still have to pay, and how much.
// Paged BY ORDER (50 orders a page), so one order's rows are never split
// across two pages. Two steps:
//
//   1. Which 50 orders: plain SQL (below). Prisma can't express "refund due
//      = paid - charge - refunded > 0" (arithmetic between columns), so this
//      one query is written by hand. Every user-typed value goes in as a
//      parameter (Prisma.sql), never pasted into the SQL text -- so a search
//      for  '; DROP TABLE ...  is just a search for that text.
//   2. Their contracts + each one's latest payment: normal Prisma.
//
// Only stored values are read (paymentStatus, paidAmount, charge, ...), never
// recalculated, so the page stays fast with years of orders.

/** Everyone may view the table (owner's decision); the branch rule applies. */
const PAYMENTS_LIST_ROLES: Role[] = [...ALL_ROLES];
/** Who sees refunds to give: the "Refund to give" filter and those rows. */
const REFUND_VIEW_ROLES: Role[] = ["OWNER"];

const PAGE_SIZE = 50;

const canSeeRefunds = (user: AuthUser) => REFUND_VIEW_ROLES.includes(user.role);

// ---------------------------------------------------------------------------
// Step 1: which orders
// ---------------------------------------------------------------------------

// A contract that still owes money. Written-off contracts count as FULLY_PAID.
const UNSETTLED = Prisma.sql`c."paymentStatus" <> 'FULLY_PAID'`;
// Same rule as refundDue() in domain/payments.ts: only after End order (charge set).
const REFUND_DUE = Prisma.sql`c.charge IS NOT NULL AND c."paidAmount" - c.charge - c."refundedAmount" > 0`;

/** "This order has a contract where …" */
const anyContract = (condition: Prisma.Sql) =>
    Prisma.sql`EXISTS (SELECT 1 FROM "Contract" c WHERE c."orderId" = o.id AND ${condition})`;

/**
 * The WHERE conditions for one filter + search -- shared by the page, its
 * count and the dashboard card. "OWES" is the card's own count (any contract
 * not fully paid); it isn't a filter button.
 */
function whereFor(
    user: AuthUser,
    query: { status: PaymentsFilter | "OWES"; branch?: Branch; search?: string },
): Prisma.Sql {
    const refunds = canSeeRefunds(user);
    const conditions: Prisma.Sql[] = [
        // Care has started: there's something to pay.
        Prisma.sql`EXISTS (SELECT 1 FROM "Contract" c WHERE c."orderId" = o.id)`,
    ];

    // The branch rule (same as visibleOrders in order.service): an OUTSIDER
    // never sees an OUTSIDE order. In the database, so hidden rows never leave it.
    if (user.role === "OUTSIDER") conditions.push(Prisma.sql`o.branch <> 'OUTSIDE'`);
    if (query.branch) conditions.push(Prisma.sql`o.branch = CAST(${query.branch} AS "Branch")`);

    if (query.search) {
        // Same matches as the View orders search: order code, CR- code, name, phones.
        const like = `%${escapeLike(query.search)}%`;
        const customerId = parseCustomerCode(query.search);
        conditions.push(Prisma.sql`(
            o.code = ${query.search.trim().toUpperCase()}
            ${customerId !== null ? Prisma.sql`OR o."customerId" = ${customerId}` : Prisma.empty}
            OR cu.name ILIKE ${like}
            OR cu."contactNumber1" ILIKE ${like}
            OR cu."contactNumber2" ILIKE ${like}
        )`);
    }

    const filters: Record<PaymentsFilter | "OWES", Prisma.Sql> = {
        OWES: anyContract(UNSETTLED),
        // Running: always. Ended: only while money is still owed (or, Owner, to give back).
        all: Prisma.sql`(o."endDate" IS NULL OR ${anyContract(UNSETTLED)}${refunds ? Prisma.sql` OR ${anyContract(REFUND_DUE)}` : Prisma.empty})`,
        NOT_PAID: anyContract(Prisma.sql`c."paymentStatus" = 'NOT_PAID'`),
        PARTLY_PAID: anyContract(Prisma.sql`c."paymentStatus" = 'PARTLY_PAID'`),
        FULLY_PAID: Prisma.sql`(o."endDate" IS NULL AND NOT ${anyContract(UNSETTLED)})`,
        // Not for others: the filter simply finds nothing.
        REFUND: refunds ? Prisma.sql`(o."endDate" IS NOT NULL AND ${anyContract(REFUND_DUE)})` : Prisma.sql`FALSE`,
    };
    conditions.push(filters[query.status]);

    return Prisma.join(conditions, " AND ");
}

const FROM = Prisma.sql`FROM "CustomerOrder" o JOIN "Customer" cu ON cu.id = o."customerId"`;

async function countOrders(db: Db, where: Prisma.Sql): Promise<number> {
    const [row] = await db.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total ${FROM} WHERE ${where}`;
    return row?.total ?? 0;
}

// ---------------------------------------------------------------------------
// Step 2: the rows
// ---------------------------------------------------------------------------

export interface PaymentsContractRow {
    id: number;
    contractNumber: number;
    /** Due date = the contract's start date (null while pending). */
    startDate: Date | null;
    rate: number;
    /** After End order: the charge for the days served (null = running, the full rate). */
    charge: number | null;
    /** What the customer must pay: the charge after End order, else the rate (minus any write-off). */
    amountDue: number;
    paidAmount: number;
    /** Still to pay. */
    balance: number;
    /** Owner only, after End order: money to give back. */
    refund: number;
    paymentStatus: PaymentStatus;
    writtenOffAmount: number;
    /** The latest payment that counts: "Paid on" and "How". */
    lastPayment: { paidOn: Date; mode: PaymentMode } | null;
}

export interface PaymentsOrderRow {
    orderId: number;
    code: string;
    branch: Branch;
    ended: boolean;
    customer: { id: number; name: string };
    contracts: PaymentsContractRow[];
}

/** One page of the payments table (50 orders), newest order first like View orders. */
export async function listPayments(
    db: Db,
    user: AuthUser,
    query: PaymentsListQuery,
): Promise<PaginatedResult<PaymentsOrderRow>> {
    assertRole(user, PAYMENTS_LIST_ROLES);
    const where = whereFor(user, query);
    const skip = (query.page - 1) * PAGE_SIZE;

    const [total, page] = await Promise.all([
        countOrders(db, where),
        // id as a tie-breaker, so rows can't repeat or vanish between pages.
        db.$queryRaw<{ id: number }[]>`
            SELECT o.id ${FROM} WHERE ${where}
            ORDER BY o."createdAt" DESC, o.id DESC
            LIMIT ${PAGE_SIZE} OFFSET ${skip}`,
    ]);
    const ids = page.map((r) => r.id);

    const orders = await db.customerOrder.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            code: true,
            branch: true,
            endDate: true,
            customer: { select: { id: true, name: true } },
            contracts: {
                select: {
                    id: true,
                    contractNumber: true,
                    startDate: true,
                    rate: true,
                    charge: true,
                    writtenOffAmount: true,
                    paidAmount: true,
                    refundedAmount: true,
                    paymentStatus: true,
                    payments: {
                        where: { voidedAt: null },
                        orderBy: [{ paidOn: "desc" }, { id: "desc" }],
                        take: 1,
                        select: { paidOn: true, mode: true },
                    },
                },
            },
        },
    });

    // findMany doesn't keep the page's order: put them back in step 1's order.
    const byId = new Map(orders.map((o) => [o.id, o]));
    const refunds = canSeeRefunds(user);
    const data = ids.flatMap((id) => {
        const order = byId.get(id);
        if (!order) return [];
        const rows = contractsToShow(order.contracts, query.status, refunds).map(
            ({ payments, refundedAmount, ...c }) => {
                const amountDue = contractAmountDue(c);
                return {
                    ...c,
                    amountDue,
                    balance: balanceDue(amountDue, c.paidAmount),
                    refund: refunds ? refundDue({ charge: c.charge, paidAmount: c.paidAmount, refundedAmount }) : 0,
                    lastPayment: payments[0] ?? null,
                };
            },
        );
        return [
            {
                orderId: order.id,
                code: order.code,
                branch: order.branch,
                ended: order.endDate !== null,
                customer: order.customer,
                contracts: rows,
            },
        ];
    });

    return {
        data,
        pagination: { page: query.page, limit: PAGE_SIZE, total, totalPages: Math.ceil(total / PAGE_SIZE) },
    };
}

export interface PaymentsSummary {
    /** Orders with a contract not fully paid. */
    toCollect: number;
    /** Owner only (else null): ended orders with money to give back. */
    toRefund: number | null;
}

/** The dashboard card: two counts, using the same conditions as the table's filters. */
export async function getPaymentsSummary(db: Db, user: AuthUser): Promise<PaymentsSummary> {
    assertRole(user, PAYMENTS_LIST_ROLES);
    const [toCollect, toRefund] = await Promise.all([
        countOrders(db, whereFor(user, { status: "OWES" })),
        canSeeRefunds(user) ? countOrders(db, whereFor(user, { status: "REFUND" })) : Promise.resolve(null),
    ]);
    return { toCollect, toRefund };
}
