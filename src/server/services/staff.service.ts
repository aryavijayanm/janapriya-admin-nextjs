import "server-only";

import { Prisma, type Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { escapeLike } from "@/server/db/like";
import { paginate, type PaginatedResult } from "@/server/db/paginate";
import { NotFoundError, ValidationError } from "@/server/domain/errors";
import { fileStore } from "@/server/integrations/storage";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import { newStaffPhotoKey, processStaffPhoto, type PhotoUpload } from "@/server/services/staff-photo";
import type { StaffInput, StaffListQuery, StaffStatusValue } from "@/server/validators/staff";

// Ported from the old NestJS StaffService, plus photos.

/**
 * Who may use the staff module -- currently every role (owner's decision:
 * list, view, add, edit, delete and enable/disable are open to all).
 * Every function below checks against this ONE list, so tightening access
 * later (e.g. no deleting for OUTSIDER) starts with a one-line change here.
 */
const STAFF_MODULE_ROLES: Role[] = [...ALL_ROLES];

const STAFF_INCLUDE = {
    services: { include: { service: true } },
} satisfies Prisma.StaffInclude;

/** A staff row with its linked services -- what every staff screen receives. */
export type StaffWithServices = Prisma.StaffGetPayload<{ include: typeof STAFF_INCLUDE }>;

type StaffSortBy = NonNullable<StaffListQuery["sortBy"]>;
type SortDir = "asc" | "desc";

// P2003 = a foreign key pointed at nothing (e.g. a service id that doesn't
// exist). P2025 = the record to update wasn't found.
function isPrismaError(error: unknown, code: "P2003" | "P2025"): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

// Maps the public sort key to the actual Prisma orderBy -- the one inversion
// (age vs dob) lives here, so nothing upstream needs to know about it.
function buildOrderBy(sortBy: StaffSortBy, sortDir: SortDir): Prisma.StaffOrderByWithRelationInput {
    if (sortBy === "age") {
        // The most recently born person is the youngest (smallest age), so
        // "age ascending" is "dob descending". nulls "last": staff without a
        // date of birth go to the end either way -- otherwise Postgres puts
        // them FIRST when sorting youngest-first.
        return { dob: { sort: sortDir === "asc" ? "desc" : "asc", nulls: "last" } };
    }
    if (sortBy === "recent") return { created_at: sortDir };
    return { [sortBy]: sortDir };
}

/**
 * The staff search: one text box matched across these fields. Shared by the
 * staff list and the order page's staff picker, so both always search the
 * same way. Excludes rating, relationshipWithGuardian, idProof (by request),
 * and dob/status (not text columns).
 */
export function staffSearchWhere(search: string): Prisma.StaffWhereInput {
    // Escaped: unescaped, a search for "_" or "%" matches every row (verified).
    const term = escapeLike(search);
    return {
        OR: [
            { name: { contains: term, mode: "insensitive" } },
            { place: { contains: term, mode: "insensitive" } },
            { contactNumber: { contains: term, mode: "insensitive" } },
            { guardianName: { contains: term, mode: "insensitive" } },
            { guardianContactNumber: { contains: term, mode: "insensitive" } },
            { verifiedAddress: { contains: term, mode: "insensitive" } },
            { idNumber: { contains: term, mode: "insensitive" } },
            { bankAccountDetails: { contains: term, mode: "insensitive" } },
            { remarks: { contains: term, mode: "insensitive" } },
        ],
    };
}

/** One page of the staff list, with sort, service filter and search. */
export async function listStaff(
    db: Db,
    user: AuthUser,
    query: StaffListQuery,
): Promise<PaginatedResult<StaffWithServices>> {
    assertRole(user, STAFF_MODULE_ROLES);

    const { page, sortBy = "name", sortDir = "asc", serviceIds, search } = query;

    // Soft-deleted staff stay in the table (so past duty/order history keeps
    // resolving their name) but never appear in a normal list.
    const where: Prisma.StaffWhereInput = {
        status: { not: "DELETED" },
        // Staff who can perform ANY of the selected services (not all of
        // them) -- the usual meaning of a multi-select filter. Compiles to
        // WHERE EXISTS, so a staff member with 3 matches still appears once.
        ...(serviceIds && serviceIds.length > 0
            ? { services: { some: { serviceId: { in: serviceIds } } } }
            : {}),
        // One search box across most text fields -- see staffSearchWhere.
        ...(search ? staffSearchWhere(search) : {}),
    };

    // id as a tiebreaker. Sorting by rating, most staff tie at the default 5,
    // and Postgres returns tied rows in no guaranteed order -- so the same
    // person could appear on page 1 AND page 2 while another never appears.
    // A unique second key makes every page's slice well-defined.
    const orderBy = [buildOrderBy(sortBy, sortDir), { id: "asc" as const }];

    return paginate(
        // count and findMany must share the same `where` or totalPages would
        // be computed against a different set than what's actually returned.
        () => db.staff.count({ where }),
        (skip, take) => db.staff.findMany({ skip, take, where, orderBy, include: STAFF_INCLUDE }),
        page,
    );
}

/**
 * One staff member, or null. Deliberately NOT filtered by status -- someone
 * following a direct link (e.g. from an old duty record) should still be able
 * to see a DISABLED or DELETED staff member's details; it's only hidden from
 * the *list*.
 */
export async function getStaff(db: Db, user: AuthUser, id: number): Promise<StaffWithServices | null> {
    assertRole(user, STAFF_MODULE_ROLES);
    return db.staff.findUnique({ where: { id }, include: STAFF_INCLUDE });
}

/** Where the browser should load a stored photo from (null = no photo). */
export async function getStaffPhotoUrl(photoKey: string | null): Promise<string | null> {
    return photoKey ? fileStore.getUrl(photoKey) : null;
}

export async function createStaff(
    db: Db,
    user: AuthUser,
    input: StaffInput,
    photo: PhotoUpload | null,
): Promise<StaffWithServices> {
    assertRole(user, STAFF_MODULE_ROLES);

    // Process the photo BEFORE writing anything: a bad file should be refused
    // without leaving a half-created staff member behind.
    const photoBytes = photo ? await processStaffPhoto(photo) : null;
    const photoKey = photoBytes ? newStaffPhotoKey() : null;

    // File first, database second. If the database write then fails, the file
    // is deleted again below. (The other order risks a staff row pointing at
    // a photo that never got saved.)
    if (photoKey && photoBytes) {
        await fileStore.save({ key: photoKey, body: photoBytes, contentType: "image/jpeg" });
    }

    const { serviceIds, dob, ...rest } = input;
    try {
        return await db.$transaction(async (tx) => {
            const staff = await tx.staff.create({
                data: { ...rest, dob: dob ? new Date(dob) : null, photoKey },
            });

            if (serviceIds.length > 0) {
                // A brand-new staff member can't already have any StaffService
                // rows, so a plain createMany is enough here.
                await tx.staffService.createMany({
                    data: serviceIds.map((serviceId) => ({ staffId: staff.id, serviceId })),
                });
            }

            return tx.staff.findUniqueOrThrow({ where: { id: staff.id }, include: STAFF_INCLUDE });
        });
    } catch (error) {
        // The row never got created, so nothing points at the saved file --
        // remove it rather than leave an orphan on disk.
        if (photoKey) await fileStore.delete(photoKey).catch(() => undefined);
        if (isPrismaError(error, "P2003")) {
            throw new ValidationError("One of the selected services no longer exists");
        }
        throw error;
    }
}

/** What the edit form asks to do with the photo. */
export interface PhotoChange {
    /** A newly chosen photo, or null to keep the current one... */
    upload: PhotoUpload | null;
    /** ...or true to delete the current photo and have none. */
    remove: boolean;
}

export async function updateStaff(
    db: Db,
    user: AuthUser,
    id: number,
    input: StaffInput,
    photoChange: PhotoChange,
): Promise<StaffWithServices> {
    assertRole(user, STAFF_MODULE_ROLES);

    const newBytes = photoChange.upload ? await processStaffPhoto(photoChange.upload) : null;
    const newKey = newBytes ? newStaffPhotoKey() : null;
    if (newKey && newBytes) {
        await fileStore.save({ key: newKey, body: newBytes, contentType: "image/jpeg" });
    }

    const { serviceIds, dob, ...rest } = input;
    let result: { staff: StaffWithServices; oldKey: string | null };
    try {
        result = await db.$transaction(async (tx) => {
            const existing = await tx.staff.findUnique({ where: { id }, select: { photoKey: true } });
            if (!existing) throw new NotFoundError("Staff not found");

            const photoData = newKey
                ? { photoKey: newKey }
                : photoChange.remove
                    ? { photoKey: null }
                    : {};

            await tx.staff.update({
                where: { id },
                // Every field is written, including nulls -- so clearing a field
                // in the form really clears it.
                data: { ...rest, dob: dob ? new Date(dob) : null, ...photoData },
            });

            // Sync the join table to exactly the submitted set: add newly
            // checked services, delete unchecked ones.
            const current = await tx.staffService.findMany({
                where: { staffId: id },
                select: { serviceId: true },
            });
            const currentIds = current.map((link) => link.serviceId);
            const toAdd = serviceIds.filter((sid) => !currentIds.includes(sid));
            const toRemove = currentIds.filter((sid) => !serviceIds.includes(sid));

            if (toAdd.length > 0) {
                await tx.staffService.createMany({
                    data: toAdd.map((serviceId) => ({ staffId: id, serviceId })),
                });
            }
            if (toRemove.length > 0) {
                await tx.staffService.deleteMany({
                    where: { staffId: id, serviceId: { in: toRemove } },
                });
            }

            const staff = await tx.staff.findUniqueOrThrow({ where: { id }, include: STAFF_INCLUDE });
            return { staff, oldKey: existing.photoKey };
        });
    } catch (error) {
        // The update didn't happen, so the newly saved file is an orphan.
        if (newKey) await fileStore.delete(newKey).catch(() => undefined);
        if (isPrismaError(error, "P2003")) {
            throw new ValidationError("One of the selected services no longer exists");
        }
        throw error;
    }

    // Only AFTER the database has switched away from the old photo is it safe
    // to delete that file. Doing it earlier, a failed update would leave the
    // record pointing at a deleted photo. A failure here is only logged: the
    // record is already correct, and an unused file costs a few KB.
    const replacedOrRemoved = newKey !== null || photoChange.remove;
    if (result.oldKey && replacedOrRemoved) {
        await fileStore.delete(result.oldKey).catch((error: unknown) => {
            console.error(`Could not delete old staff photo ${result.oldKey}:`, error);
        });
    }

    return result.staff;
}

/**
 * Enable, disable or (soft) delete. DELETED keeps the row -- and the photo --
 * so history that references this staff member keeps resolving.
 */
export async function setStaffStatus(
    db: Db,
    user: AuthUser,
    id: number,
    status: StaffStatusValue,
): Promise<void> {
    assertRole(user, STAFF_MODULE_ROLES);
    try {
        await db.staff.update({ where: { id }, data: { status } });
    } catch (error) {
        if (isPrismaError(error, "P2025")) throw new NotFoundError("Staff not found");
        throw error;
    }
}
