import "server-only";

import { Prisma, type Customer, type Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { escapeLike } from "@/server/db/like";
import { paginate, type PaginatedResult } from "@/server/db/paginate";
import { NotFoundError } from "@/server/domain/errors";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import {
    parseCustomerCode,
    type CustomerInput,
    type CustomerListQuery,
    type CustomerStatusValue,
} from "@/server/validators/customer";

/**
 * Who may use the customer module -- currently every role. Every function
 * below checks against this ONE list, so tightening access later is a
 * one-line change here.
 */
const CUSTOMER_MODULE_ROLES: Role[] = [...ALL_ROLES];

/**
 * How similar (0 to 1) an address must be to an existing customer's to show
 * the "possible duplicate" warning. Chosen as 0.6 after testing pg_trgm on
 * real-style Kerala addresses: it catches the same house typed differently
 * (pincode added, "House" vs "Veedu") at the cost of a few false alarms --
 * acceptable, since it's only a warning with "Save anyway".
 */
const ADDRESS_SIMILARITY_THRESHOLD = 0.6;
const MAX_DUPLICATES_SHOWN = 5;

/** An existing customer who might be the same person as the one being saved. */
export interface PossibleDuplicate {
    id: number;
    name: string;
    address: string;
    /** A phone number matched on its last 10 digits. */
    phoneMatch: boolean;
    /** The address reached ADDRESS_SIMILARITY_THRESHOLD -- decided here, so
     *  the browser never needs its own copy of the threshold. */
    addressMatch: boolean;
    /** Address similarity as a whole percentage (0-100). */
    addressScore: number;
}

/**
 * Saving either succeeds or comes back with possible duplicates for the user
 * to look at -- never both. A plain result, not an exception: a duplicate is
 * a normal question to ask, not an error.
 */
export type SaveCustomerResult =
    | { kind: "saved"; customer: Customer }
    | { kind: "possibleDuplicates"; duplicates: PossibleDuplicate[] };

// P2025 = the record to update wasn't found.
function isPrismaError(error: unknown, code: "P2025"): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/** "+91 98765-43210" -> "9876543210". The same rule is applied in SQL below. */
function lastTenDigits(phone: string): string {
    return phone.replace(/\D/g, "").slice(-10);
}

/**
 * Customers (not deleted, not `excludeId`) sharing a phone number on its
 * last 10 digits, or with an address at least ADDRESS_SIMILARITY_THRESHOLD
 * similar. Phone matches are listed first, then by address similarity.
 *
 * Raw SQL because Prisma's query builder has no similarity() (it comes from
 * the pg_trgm extension). Every ${...} becomes a query PARAMETER, never text
 * pasted into the SQL, so this is not open to SQL injection.
 *
 * '[^0-9]' rather than '\D': inside this JavaScript template, a backslash is
 * removed before Prisma ever sees it -- '\D' would arrive as 'D' and the phone
 * comparison would silently stop working.
 */
async function findPossibleDuplicates(
    db: Db,
    input: Pick<CustomerInput, "contactNumber1" | "contactNumber2" | "address">,
    excludeId?: number,
): Promise<PossibleDuplicate[]> {
    const phones = [input.contactNumber1, input.contactNumber2]
        .filter((phone): phone is string => !!phone)
        .map(lastTenDigits)
        .filter((digits) => digits.length > 0);

    const rows = await db.$queryRaw<
        { id: number; name: string; address: string; phoneMatch: boolean; score: number }[]
    >`
        SELECT id, name, address,
               (right(regexp_replace("contactNumber1", '[^0-9]', '', 'g'), 10) = ANY(${phones}::text[])
                OR right(regexp_replace(COALESCE("contactNumber2", ''), '[^0-9]', '', 'g'), 10) = ANY(${phones}::text[]))
                   AS "phoneMatch",
               similarity(address, ${input.address})::float8 AS score
        FROM "Customer"
        WHERE status <> 'DELETED'
          ${excludeId !== undefined ? Prisma.sql`AND id <> ${excludeId}` : Prisma.empty}
          AND (
                right(regexp_replace("contactNumber1", '[^0-9]', '', 'g'), 10) = ANY(${phones}::text[])
             OR right(regexp_replace(COALESCE("contactNumber2", ''), '[^0-9]', '', 'g'), 10) = ANY(${phones}::text[])
             OR similarity(address, ${input.address}) >= ${ADDRESS_SIMILARITY_THRESHOLD}
          )
        ORDER BY "phoneMatch" DESC, score DESC
        LIMIT ${MAX_DUPLICATES_SHOWN}
    `;

    return rows.map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address,
        phoneMatch: row.phoneMatch,
        addressMatch: row.score >= ADDRESS_SIMILARITY_THRESHOLD,
        addressScore: Math.trunc(row.score * 100),
    }));
}

/** One page of the customer list, with sort and search. */
export async function listCustomers(
    db: Db,
    user: AuthUser,
    query: CustomerListQuery,
): Promise<PaginatedResult<Customer>> {
    assertRole(user, CUSTOMER_MODULE_ROLES);

    const { page, sortBy = "name", sortDir = "asc", search } = query;

    // Typing a customer code ("CR-000042", "cr-42") goes straight to that
    // customer instead of a text search.
    const codeId = search ? parseCustomerCode(search) : null;
    // Escaped: unescaped, a search for "_" or "%" matches every row.
    const term = search ? escapeLike(search) : undefined;

    // Soft-deleted customers stay in the table (their orders and payments
    // keep resolving) but never appear in a normal list.
    const where: Prisma.CustomerWhereInput = {
        status: { not: "DELETED" },
        ...(codeId !== null
            ? { id: codeId }
            : term
                ? {
                    OR: [
                        { name: { contains: term, mode: "insensitive" } },
                        { contactNumber1: { contains: term, mode: "insensitive" } },
                        { contactNumber2: { contains: term, mode: "insensitive" } },
                        { address: { contains: term, mode: "insensitive" } },
                        { email: { contains: term, mode: "insensitive" } },
                        { idNumber: { contains: term, mode: "insensitive" } },
                        { remarks: { contains: term, mode: "insensitive" } },
                    ],
                }
                : {}),
    };

    // "code" is the id (CR-000042 = id 42). Otherwise id is the tiebreaker,
    // so customers with the same name can't repeat or go missing between pages.
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] =
        sortBy === "code" ? [{ id: sortDir }] : [{ [sortBy]: sortDir }, { id: "asc" }];

    return paginate(
        // count and findMany share one `where`, or totalPages would describe
        // a different set than the rows returned.
        () => db.customer.count({ where }),
        (skip, take) => db.customer.findMany({ skip, take, where, orderBy }),
        page,
    );
}

/** A customer as a picker shows them. */
export interface CustomerOption {
    id: number;
    name: string;
    contactNumber1: string;
    address: string;
}

const CUSTOMER_PICKER_LIMIT = 20;

/**
 * ACTIVE customers matching a search, for pickers (e.g. "New order: which
 * customer?"). Only active ones, since only they can get new orders. Matches a
 * customer code ("CR-42") directly, otherwise name, phones and address.
 */
export async function searchActiveCustomers(db: Db, user: AuthUser, search: string): Promise<CustomerOption[]> {
    assertRole(user, CUSTOMER_MODULE_ROLES);

    const codeId = parseCustomerCode(search);
    const term = escapeLike(search);

    return db.customer.findMany({
        where: {
            status: "ACTIVE",
            ...(codeId !== null
                ? { id: codeId }
                : {
                    OR: [
                        { name: { contains: term, mode: "insensitive" } },
                        { contactNumber1: { contains: term, mode: "insensitive" } },
                        { contactNumber2: { contains: term, mode: "insensitive" } },
                        { address: { contains: term, mode: "insensitive" } },
                    ],
                }),
        },
        select: { id: true, name: true, contactNumber1: true, address: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
        take: CUSTOMER_PICKER_LIMIT,
    });
}

/**
 * One customer, or null. Not filtered by status: a direct link to a
 * DISABLED or DELETED customer still opens -- they're only hidden from lists.
 */
export async function getCustomer(db: Db, user: AuthUser, id: number): Promise<Customer | null> {
    assertRole(user, CUSTOMER_MODULE_ROLES);
    return db.customer.findUnique({ where: { id } });
}

export async function createCustomer(
    db: Db,
    user: AuthUser,
    input: CustomerInput,
    options: { confirmDuplicate: boolean },
): Promise<SaveCustomerResult> {
    assertRole(user, CUSTOMER_MODULE_ROLES);

    if (!options.confirmDuplicate) {
        const duplicates = await findPossibleDuplicates(db, input);
        if (duplicates.length > 0) return { kind: "possibleDuplicates", duplicates };
    }

    const customer = await db.customer.create({ data: input });
    return { kind: "saved", customer };
}

export async function updateCustomer(
    db: Db,
    user: AuthUser,
    id: number,
    input: CustomerInput,
    options: { confirmDuplicate: boolean },
): Promise<SaveCustomerResult> {
    assertRole(user, CUSTOMER_MODULE_ROLES);

    const existing = await db.customer.findUnique({
        where: { id },
        select: { contactNumber1: true, contactNumber2: true, address: true },
    });
    if (!existing) throw new NotFoundError("Customer not found");

    // Only re-check when something the check looks at actually changed --
    // otherwise fixing a typo in the remarks of a customer who shares a
    // building with another family would warn on every save.
    const identityChanged =
        existing.contactNumber1 !== input.contactNumber1 ||
        existing.contactNumber2 !== input.contactNumber2 ||
        existing.address !== input.address;

    if (identityChanged && !options.confirmDuplicate) {
        const duplicates = await findPossibleDuplicates(db, input, id);
        if (duplicates.length > 0) return { kind: "possibleDuplicates", duplicates };
    }

    try {
        // Every field is written, including nulls -- clearing a field clears it.
        const customer = await db.customer.update({ where: { id }, data: input });
        return { kind: "saved", customer };
    } catch (error) {
        if (isPrismaError(error, "P2025")) throw new NotFoundError("Customer not found");
        throw error;
    }
}

/**
 * Enable, disable or (soft) delete. DELETED keeps the row so orders and
 * payments that reference this customer keep resolving.
 */
export async function setCustomerStatus(
    db: Db,
    user: AuthUser,
    id: number,
    status: CustomerStatusValue,
): Promise<void> {
    assertRole(user, CUSTOMER_MODULE_ROLES);
    try {
        await db.customer.update({ where: { id }, data: { status } });
    } catch (error) {
        if (isPrismaError(error, "P2025")) throw new NotFoundError("Customer not found");
        throw error;
    }
}
