import "server-only";

import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { Db } from "@/server/db/client";
import { AuthError } from "@/server/domain/errors";
import type { AuthUser } from "@/server/services/authz";
import type { LoginInput } from "@/server/validators/auth";

// How long a session survives WITHOUT activity. The old JWT was a hard 3h
// from login; here it's 1h from last use, so you aren't thrown out mid-task
// (see the sliding renewal in getUserBySession).
const SESSION_IDLE_MS = 1 * 60 * 60 * 1000;

// One message for every failure. Saying "no such user" vs "wrong password"
// would let anyone discover which usernames exist.
const INVALID_CREDENTIALS = "Invalid username or password";

// The cookie holds the raw token; the database holds only its SHA-256 hash.
// So a leaked database dump contains no usable sessions. SHA-256, not bcrypt:
// the token is 32 random bytes -- nothing to brute-force -- and this runs on
// every request, where bcrypt's deliberate slowness would hurt.
function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

// A real bcrypt hash that no password matches, built once on first use.
// When the username doesn't exist we still run a full bcrypt.compare against
// it. Otherwise "unknown user" would answer in ~1ms and "wrong password" in
// ~250ms, and that timing difference alone would reveal which usernames
// exist -- the same leak the single error message above prevents.
let dummyHash: Promise<string> | undefined;
function getDummyHash(): Promise<string> {
    dummyHash ??= bcrypt.hash("never-a-real-password", 12);
    return dummyHash;
}

/**
 * Verifies credentials and opens a session.
 * Returns the raw token for the caller to put in a cookie; the service itself
 * never touches cookies, so this works unchanged from NestJS after the split.
 */
export async function login(
    db: Db,
    input: LoginInput,
): Promise<{ token: string; user: AuthUser }> {
    const username = input.username.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { username } });

    const passwordMatches = await bcrypt.compare(
        input.password,
        user ? user.password : await getDummyHash(),
    );

    // Checked AFTER the compare, so a disabled or missing account takes the
    // same time to reject as a wrong password.
    if (!user || !user.is_active || !passwordMatches) {
        throw new AuthError(INVALID_CREDENTIALS);
    }

    const token = randomBytes(32).toString("base64url");
    const now = new Date();

    // Both writes or neither: no session row for a login that didn't record,
    // and no recorded login without a session.
    await db.$transaction([
        db.user.update({
            where: { id: user.id },
            data: { last_login_at: now },
        }),
        db.session.create({
            data: {
                id: hashToken(token),
                userId: user.id,
                expiresAt: new Date(now.getTime() + SESSION_IDLE_MS),
            },
        }),
    ]);

    return {
        token,
        user: {
            id: user.id,
            username: user.username,
            name: user.name,
            role: user.role,
            designation: user.designation,
        },
    };
}

/**
 * Resolves a cookie token to the user it belongs to, or null.
 *
 * This is where database sessions earn their keep over JWT: the user's
 * CURRENT row is read every time, so disabling them or changing their role
 * takes effect on their very next request.
 */
export async function getUserBySession(db: Db, token: string): Promise<AuthUser | null> {
    const sessionId = hashToken(token);
    const session = await db.session.findUnique({
        where: { id: sessionId },
        include: {
            user: {
                select: {
                    id: true,
                    username: true,
                    name: true,
                    role: true,
                    designation: true,
                    is_active: true,
                },
            },
        },
    });

    if (!session) return null;

    const now = Date.now();

    if (session.expiresAt.getTime() <= now) {
        // deleteMany, not delete: it doesn't throw if a parallel request
        // already removed the row.
        await db.session.deleteMany({ where: { id: sessionId } });
        return null;
    }

    if (!session.user.is_active) return null;

    // Sliding expiry, renewed only once past half its life. Renewing on EVERY
    // request would mean a database write per page view; this way an active
    // user costs at most one write per half-period (~30 minutes at 1h), and
    // still never expires.
    if (session.expiresAt.getTime() - now < SESSION_IDLE_MS / 2) {
        await db.session.update({
            where: { id: sessionId },
            data: { expiresAt: new Date(now + SESSION_IDLE_MS) },
        });
    }

    const { id, username, name, role, designation } = session.user;
    return { id, username, name, role, designation };
}

/** Ends one session -- a real logout, unlike deleting a JWT cookie. */
export async function logout(db: Db, token: string): Promise<void> {
    await db.session.deleteMany({ where: { id: hashToken(token) } });
}
