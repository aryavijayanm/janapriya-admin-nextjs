import "server-only";

import { Prisma, type Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { paginate, type PaginatedResult } from "@/server/db/paginate";
import { todayInKerala } from "@/server/domain/age";
import { fromIsoDate } from "@/server/domain/days";
import { NotFoundError, ValidationError } from "@/server/domain/errors";
import { assertRole, type AuthUser } from "@/server/services/authz";
import type {
    AccountDateRange,
    AccountDirectionValue,
    AccountEntryInput,
    AccountSource,
} from "@/server/validators/account-book";

// The accounts book: every rupee in and out, day by day.
//
// Only hand-typed lines (rent, food, water...) are stored in AccountEntry.
// Customer payments, refunds and staff salary are READ LIVE from their own
// tables and merged into one list with UNION ALL -- never copied, so the
// book can't disagree with them. A payment voided on the order page shows
// here crossed out by itself, with no extra code.
//
//   SELECT ... FROM "AccountEntry"       -- typed lines (deleted ones left out)
//   UNION ALL SELECT ... FROM "Payment"  -- IN
//   UNION ALL SELECT ... FROM "Refund"   -- OUT
//   UNION ALL SELECT ... FROM "StaffAccountEntry"  -- PAID = OUT, RECEIVED = IN
//   ORDER BY date ...
//
// Every part returns the SAME columns (that's what UNION needs), so each
// part fills the ones it doesn't have with NULL. Each table has an index on
// its date column, so a date range (the Excel download) reads only those days.

/** Everyone except OUTSIDER may view, add, edit and delete (owner's decision). */
const ACCOUNT_BOOK_ROLES: Role[] = ["OWNER", "STAFF"];
/** Only the Owner downloads the book. */
const ACCOUNT_EXPORT_ROLES: Role[] = ["OWNER"];

const PAGE_SIZE = 50;

/** One line of the book, whatever table it comes from. */
export interface AccountBookRow {
    source: AccountSource;
    /** The id in its own table (an AccountEntry id only when source = ENTRY). */
    id: number;
    date: Date;
    direction: AccountDirectionValue;
    /** Always a positive number; `direction` says in or out. */
    amount: number;
    /** The stored "how" value -- label it with accountModeLabel(source, mode). */
    mode: string;
    /** Customer or staff name (null for typed entries). */
    name: string | null;
    orderCode: string | null;
    contractNumber: number | null;
    /** The reason (typed entries), refund / staff remarks. */
    remarks: string | null;
    accountDetails: string | null;
    voidedAt: Date | null;
    voidedBy: string | null;
    voidReason: string | null;
    recordedBy: string | null;
}

/** "Date between from and to" for one table's date column. */
function inRange(column: Prisma.Sql, range: AccountDateRange): Prisma.Sql {
    return Prisma.sql`AND ${column} BETWEEN CAST(${range.from} AS date) AND CAST(${range.to} AS date)`;
}

/**
 * The four parts of the book, merged, for a date range. Shared by the day
 * card, the month table and the download. The range goes inside each part,
 * so each table's date index picks out just those days.
 */
function bookRows(range: AccountDateRange): Prisma.Sql {
    return Prisma.sql`
        SELECT 'ENTRY' AS source, e.id, e."entryDate" AS date, e.direction::text AS direction,
               e.amount, e.mode::text AS mode,
               NULL::text AS name, NULL::text AS "orderCode", NULL::int AS "contractNumber",
               e.reason AS remarks, NULL::text AS "accountDetails",
               NULL::timestamptz AS "voidedAt", NULL::text AS "voidedBy", NULL::text AS "voidReason",
               ru.name AS "recordedBy", e."createdAt"
        FROM "AccountEntry" e
        LEFT JOIN "User" ru ON ru.id = e."recordedById"
        WHERE e.status = 'ACTIVE' ${inRange(Prisma.sql`e."entryDate"`, range)}

        UNION ALL
        SELECT 'PAYMENT', p.id, p."paidOn", 'IN', p.amount, p.mode::text,
               cu.name, o.code, c."contractNumber",
               NULL, p."accountDetails",
               p."voidedAt", vu.name, p."voidReason",
               ru.name, p."createdAt"
        FROM "Payment" p
        JOIN "Contract" c ON c.id = p."contractId"
        JOIN "CustomerOrder" o ON o.id = c."orderId"
        JOIN "Customer" cu ON cu.id = o."customerId"
        LEFT JOIN "User" ru ON ru.id = p."recordedById"
        LEFT JOIN "User" vu ON vu.id = p."voidedById"
        WHERE TRUE ${inRange(Prisma.sql`p."paidOn"`, range)}

        UNION ALL
        SELECT 'REFUND', r.id, r."refundedOn", 'OUT', r.amount, r.mode::text,
               cu.name, o.code, c."contractNumber",
               r.remarks, r."accountDetails",
               r."voidedAt", vu.name, r."voidReason",
               ru.name, r."createdAt"
        FROM "Refund" r
        JOIN "Contract" c ON c.id = r."contractId"
        JOIN "CustomerOrder" o ON o.id = c."orderId"
        JOIN "Customer" cu ON cu.id = o."customerId"
        LEFT JOIN "User" ru ON ru.id = r."recordedById"
        LEFT JOIN "User" vu ON vu.id = r."voidedById"
        WHERE TRUE ${inRange(Prisma.sql`r."refundedOn"`, range)}

        UNION ALL
        -- Only entries where money moved. PAID is stored as a minus amount: shown as a plain OUT.
        -- (EXTRA and WRITE_OFF move no money, so they aren't in the book.)
        SELECT CASE WHEN se.type = 'PAID' THEN 'STAFF_PAID' ELSE 'STAFF_RECEIVED' END,
               se.id, se."entryDate",
               CASE WHEN se.type = 'PAID' THEN 'OUT' ELSE 'IN' END,
               abs(se.amount), se.mode::text,
               s.name, NULL, NULL,
               se.remarks, se."accountDetails",
               se."voidedAt", vu.name, se."voidReason",
               ru.name, se."createdAt"
        FROM "StaffAccountEntry" se
        JOIN "Staff" s ON s.id = se."staffId"
        LEFT JOIN "User" ru ON ru.id = se."recordedById"
        LEFT JOIN "User" vu ON vu.id = se."voidedById"
        WHERE se.type IN ('PAID', 'RECEIVED') ${inRange(Prisma.sql`se."entryDate"`, range)}`;
}

// Same day: the one entered last comes first (newest first); source + id
// break any remaining tie, so rows can't repeat or vanish between pages.
const NEWEST_FIRST = Prisma.sql`ORDER BY date DESC, "createdAt" DESC, source, id DESC`;
const OLDEST_FIRST = Prisma.sql`ORDER BY date, "createdAt", source, id`;

export interface AccountDay {
    /** Every row of the day, voided ones included (shown crossed out), newest first. */
    rows: AccountBookRow[];
    /** Voided rows don't count. */
    totalIn: number;
    totalOut: number;
}

/** One day of the book (the day card). A day has few rows, so no paging. */
export async function getAccountDay(db: Db, user: AuthUser, day: string): Promise<AccountDay> {
    assertRole(user, ACCOUNT_BOOK_ROLES);
    const rows = await db.$queryRaw<AccountBookRow[]>`
        SELECT * FROM (${bookRows({ from: day, to: day })}) book ${NEWEST_FIRST}`;
    let totalIn = 0;
    let totalOut = 0;
    for (const row of rows) {
        if (row.voidedAt) continue;
        if (row.direction === "IN") totalIn += row.amount;
        else totalOut += row.amount;
    }
    return { rows, totalIn, totalOut };
}

/** One page (50 rows) of a date range -- this month's table. Newest first, voided rows included. */
export async function listAccountBook(
    db: Db,
    user: AuthUser,
    range: AccountDateRange,
    page: number,
): Promise<PaginatedResult<AccountBookRow>> {
    assertRole(user, ACCOUNT_BOOK_ROLES);
    const rows = bookRows(range);
    return paginate(
        async () => {
            const [row] = await db.$queryRaw<{ total: number }[]>`SELECT count(*)::int AS total FROM (${rows}) book`;
            return row?.total ?? 0;
        },
        (skip, take) => db.$queryRaw<AccountBookRow[]>`SELECT * FROM (${rows}) book ${NEWEST_FIRST} LIMIT ${take} OFFSET ${skip}`,
        page,
        PAGE_SIZE,
    );
}

/**
 * Owner only: every row between two dates (both included), oldest first --
 * for the Excel file. Voided rows are left out (owner's decision): the file
 * holds only money that really moved.
 */
export async function getAccountBookForExport(
    db: Db,
    user: AuthUser,
    range: AccountDateRange,
): Promise<AccountBookRow[]> {
    assertRole(user, ACCOUNT_EXPORT_ROLES);
    return db.$queryRaw<AccountBookRow[]>`
        SELECT * FROM (${bookRows(range)}) book WHERE "voidedAt" IS NULL ${OLDEST_FIRST}`;
}

// ---------------------------------------------------------------------------
// Typed entries: add, edit, delete (soft)
// ---------------------------------------------------------------------------

function assertNotFuture(isoDate: string) {
    // Both are yyyy-mm-dd, so plain text order is date order.
    if (isoDate > todayInKerala()) throw new ValidationError("The date can't be in the future");
}

function entryData(input: AccountEntryInput) {
    return {
        entryDate: fromIsoDate(input.entryDate),
        direction: input.direction,
        amount: input.amount,
        mode: input.mode,
        reason: input.reason,
    };
}

export async function addAccountEntry(db: Db, user: AuthUser, input: AccountEntryInput): Promise<void> {
    assertRole(user, ACCOUNT_BOOK_ROLES);
    assertNotFuture(input.entryDate);
    await db.accountEntry.create({ data: { ...entryData(input), recordedById: user.id } });
}

/** Only an ACTIVE entry can be changed: a deleted one is gone from the book. */
export async function updateAccountEntry(db: Db, user: AuthUser, entryId: number, input: AccountEntryInput): Promise<void> {
    assertRole(user, ACCOUNT_BOOK_ROLES);
    assertNotFuture(input.entryDate);
    // updateMany with the status in the WHERE: the check and the change are
    // one statement, so a delete in another tab can't slip in between.
    const { count } = await db.accountEntry.updateMany({
        where: { id: entryId, status: "ACTIVE" },
        data: { ...entryData(input), updatedById: user.id },
    });
    if (count === 0) throw new NotFoundError("This entry was not found -- it may have been deleted");
}

/** Soft delete: the row stays in the database with who and when, hidden from the book. */
export async function deleteAccountEntry(db: Db, user: AuthUser, entryId: number): Promise<void> {
    assertRole(user, ACCOUNT_BOOK_ROLES);
    const { count } = await db.accountEntry.updateMany({
        where: { id: entryId, status: "ACTIVE" },
        data: { status: "DELETED", deletedById: user.id, deletedAt: new Date() },
    });
    if (count === 0) throw new NotFoundError("This entry was not found -- it may have been deleted already");
}
