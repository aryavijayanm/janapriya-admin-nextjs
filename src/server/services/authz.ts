import type { Role } from "@prisma/client";
import { ForbiddenError } from "@/server/domain/errors";

// The authenticated caller, as every service expects to receive it. A plain
// shape rather than the full Prisma `User` row, so no service ever has
// access to a password hash it has no business reading.
export interface AuthUser {
    id: number;
    username: string;
    name: string;
    role: Role;
    designation: string | null;
}

/** Every role -- for operations open to anyone who is logged in. */
export const ALL_ROLES: Role[] = ["OWNER", "STAFF", "OUTSIDER"];

/**
 * Throws unless `user` holds one of `allowed`.
 *
 * This lives in the service layer on purpose, not in middleware. Middleware
 * protects a URL; this protects the operation. The difference matters because
 * the same service is also reachable from a cron job, a Route Handler, or a
 * NestJS controller after the split -- and in each of those cases the
 * middleware that guarded the page is simply not in the path.
 *
 * Next.js specifically rewards this: CVE-2025-29927 was a middleware
 * authorization bypass, and the guidance since has been to enforce
 * authorization in the data layer rather than at the edge.
 */
export function assertRole(user: AuthUser, allowed: Role[]): void {
    if (!allowed.includes(user.role)) {
        throw new ForbiddenError("You do not have permission to do this");
    }
}
