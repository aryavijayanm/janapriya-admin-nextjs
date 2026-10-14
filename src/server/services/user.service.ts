import "server-only";

import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { NotFoundError, ValidationError } from "@/server/domain/errors";
import { assertRole, type AuthUser } from "@/server/services/authz";
import type { CreateUserInput, UpdateUserInput } from "@/server/validators/user";

// Ported from the old NestJS UserService. Every function takes (db, user, ...)
// and checks the role itself -- the old @Roles(Role.OWNER) controller
// decorator becomes the first line of each function, so the rule travels with
// the logic to wherever it is called from.

const SALT_ROUNDS = 12;

// Every column except `password` -- used by every query here, so it's
// structurally hard to leak a password hash to the browser.
const SAFE_SELECT = {
    id: true,
    name: true,
    username: true,
    designation: true,
    role: true,
    is_active: true,
    created_at: true,
    updated_at: true,
    last_login_at: true,
} satisfies Prisma.UserSelect;

// The row shape the UI receives, derived from SAFE_SELECT -- add a column
// there and this type follows automatically. (Replaces the hand-written
// `User` interface the old frontend had to keep in sync by hand.)
export type UserListItem = Prisma.UserGetPayload<{ select: typeof SAFE_SELECT }>;

// Prisma reports database rule violations as coded errors:
//   P2002 = unique constraint failed, P2025 = record not found.
function isPrismaError(error: unknown, code: "P2002" | "P2025"): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

export async function listUsers(db: Db, user: AuthUser): Promise<UserListItem[]> {
    assertRole(user, ["OWNER"]);
    return db.user.findMany({ select: SAFE_SELECT, orderBy: { name: "asc" } });
}

export async function createUser(
    db: Db,
    user: AuthUser,
    input: CreateUserInput,
): Promise<UserListItem> {
    assertRole(user, ["OWNER"]);
    const { password, ...rest } = input;

    try {
        // is_active (true) and last_login_at (null) are left to the database
        // defaults -- creating an account isn't the same as logging in.
        return await db.user.create({
            data: { ...rest, password: await bcrypt.hash(password, SALT_ROUNDS) },
            select: SAFE_SELECT,
        });
    } catch (error) {
        // Not a pre-check ("does this username exist?") followed by an insert:
        // two requests could both pass the check. The unique index decides,
        // atomically, and we translate its refusal into a readable message.
        if (isPrismaError(error, "P2002")) {
            throw new ValidationError("Username already exists");
        }
        throw error;
    }
}

export async function updateUser(
    db: Db,
    user: AuthUser,
    targetId: number,
    input: UpdateUserInput,
): Promise<UserListItem> {
    assertRole(user, ["OWNER"]);
    const { password, ...rest } = input;

    const data: Prisma.UserUpdateInput = { ...rest };
    if (password) {
        // Existing logins are deliberately left alone on a password change
        // (owner's decision); only disabling an account ends sessions.
        data.password = await bcrypt.hash(password, SALT_ROUNDS);
    }

    try {
        return await db.user.update({ where: { id: targetId }, data, select: SAFE_SELECT });
    } catch (error) {
        if (isPrismaError(error, "P2025")) throw new NotFoundError("User not found");
        throw error;
    }
}

export async function setUserActive(
    db: Db,
    user: AuthUser,
    targetId: number,
    isActive: boolean,
): Promise<void> {
    assertRole(user, ["OWNER"]);

    // The rule that matters. The hidden button in UserTable is only a
    // convenience -- this is what stops it, however the action is called.
    if (targetId === user.id && !isActive) {
        throw new ValidationError("You cannot disable your own account");
    }

    try {
        if (isActive) {
            await db.user.update({ where: { id: targetId }, data: { is_active: true } });
        } else {
            // Disabling also logs them out everywhere: their session rows go in
            // the same transaction, so they're sent to /login on their next
            // click, and re-enabling later means a fresh login rather than an
            // old session coming back to life.
            await db.$transaction([
                db.user.update({ where: { id: targetId }, data: { is_active: false } }),
                db.session.deleteMany({ where: { userId: targetId } }),
            ]);
        }
    } catch (error) {
        if (isPrismaError(error, "P2025")) throw new NotFoundError("User not found");
        throw error;
    }
}
