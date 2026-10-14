import "server-only";

import { Prisma, type Service } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { escapeLike } from "@/server/db/like";
import { NotFoundError, ValidationError } from "@/server/domain/errors";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import type { ServiceInput } from "@/server/validators/service";

// Ported from the old NestJS ServiceService. Everything here is Owner-only,
// as the old controller's management routes were. (The old "any logged-in
// role may read ACTIVE services" endpoint isn't needed yet -- it returns with
// the staff module, which is the first thing that uses it.)

function isPrismaError(error: unknown, code: "P2002" | "P2025"): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

/**
 * Throws a readable message if another service already has this name or
 * abbreviation. The old code worked out WHICH field clashed from the Prisma
 * error's `meta.target`; that shape isn't verified under Prisma 7's driver
 * adapter, so we ask the database directly instead -- correct either way.
 *
 * Names are compared IGNORING CASE ("baby care" clashes with "Baby Care").
 * The database's unique index compares exactly, so this check is the only
 * thing enforcing case-insensitivity for names -- fine with a single Owner
 * managing services. Abbreviations need no special handling: the schema
 * uppercases them, so an exact comparison (and the index) is enough.
 */
async function assertNoDuplicate(db: Db, input: ServiceInput, excludeId?: number): Promise<void> {
    const clash = await db.service.findFirst({
        where: {
            OR: [
                // escapeLike: without it, `_` and `%` in a name act as wildcards.
                { name: { equals: escapeLike(input.name), mode: "insensitive" } },
                { abbreviation: input.abbreviation },
            ],
            // When editing, the service being edited doesn't clash with itself.
            ...(excludeId !== undefined ? { NOT: { id: excludeId } } : {}),
        },
        select: { name: true },
    });
    if (clash) {
        const field = clash.name.toLowerCase() === input.name.toLowerCase() ? "name" : "abbreviation";
        throw new ValidationError(`A service with this ${field} already exists`);
    }
}

// The check above and the write that follows are two separate statements, so
// two simultaneous requests could both pass the check. The unique index still
// refuses the second write; this turns that refusal into a message.
const DUPLICATE_FALLBACK = "A service with this name or abbreviation already exists";

/** What a staff form's service checkboxes need. */
export type ServiceOption = Pick<Service, "id" | "name" | "is_active">;

/**
 * The currently offered services -- the staff list's filter checkboxes.
 * Any logged-in role (the old "GET /services" endpoint, back now that staff
 * is its first user).
 */
export async function listActiveServices(db: Db, user: AuthUser): Promise<Service[]> {
    assertRole(user, ALL_ROLES);
    return db.service.findMany({ where: { is_active: true }, orderBy: { name: "asc" } });
}

/**
 * Checkbox options for the staff form: every active service, PLUS the given
 * ids even if those services are now disabled. Editing passes the staff
 * member's current links, so a link to a since-disabled service still
 * appears and isn't silently dropped on save (the old project's bug).
 */
export async function listServiceOptions(
    db: Db,
    user: AuthUser,
    includeIds: number[],
): Promise<ServiceOption[]> {
    assertRole(user, ALL_ROLES);
    return db.service.findMany({
        where: { OR: [{ is_active: true }, { id: { in: includeIds } }] },
        select: { id: true, name: true, is_active: true },
        orderBy: { name: "asc" },
    });
}

/** Includes disabled services, so they can be re-enabled from the management page. */
export async function listAllServices(db: Db, user: AuthUser): Promise<Service[]> {
    assertRole(user, ["OWNER"]);
    return db.service.findMany({ orderBy: { name: "asc" } });
}

export async function createService(db: Db, user: AuthUser, input: ServiceInput): Promise<Service> {
    assertRole(user, ["OWNER"]);
    await assertNoDuplicate(db, input);

    try {
        return await db.service.create({ data: input });
    } catch (error) {
        if (isPrismaError(error, "P2002")) throw new ValidationError(DUPLICATE_FALLBACK);
        throw error;
    }
}

export async function updateService(
    db: Db,
    user: AuthUser,
    id: number,
    input: ServiceInput,
): Promise<Service> {
    assertRole(user, ["OWNER"]);
    await assertNoDuplicate(db, input, id);

    try {
        return await db.service.update({ where: { id }, data: input });
    } catch (error) {
        if (isPrismaError(error, "P2002")) throw new ValidationError(DUPLICATE_FALLBACK);
        if (isPrismaError(error, "P2025")) throw new NotFoundError("Service not found");
        throw error;
    }
}

/**
 * Enable / Disable. Disabling is the "removal" for services: the row stays, so
 * staff linked to it are unaffected, but it stops being offered in forms.
 */
export async function setServiceActive(
    db: Db,
    user: AuthUser,
    id: number,
    isActive: boolean,
): Promise<Service> {
    assertRole(user, ["OWNER"]);

    try {
        return await db.service.update({ where: { id }, data: { is_active: isActive } });
    } catch (error) {
        if (isPrismaError(error, "P2025")) throw new NotFoundError("Service not found");
        throw error;
    }
}
