import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { getUserBySession } from "@/server/services/auth.service";
import type { AuthUser } from "@/server/services/authz";

// The ONE file that knows a session lives in a cookie. Services only ever see
// a token string (auth.service) or a user (every other service). After the
// split, NestJS reads the same cookie in a guard and calls the same
// getUserBySession -- only this file is Next.js-specific, and it stays behind.
//
// The leading underscore in app/_lib keeps Next.js from treating this folder
// as a route.

export const SESSION_COOKIE = "session";

/**
 * The logged-in user, or null. Never redirects.
 *
 * cache() makes this run at most ONCE per request, no matter how many
 * layouts, pages and components ask -- one session lookup per page view.
 */
export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return null;
    return getUserBySession(db, token);
});

/**
 * For protected pages and Server Actions: returns { db, user } or sends the
 * visitor to /login. Services are then called as service(db, user, input).
 */
export const requireUser = cache(async () => {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    return { db, user };
});

// Cookie writes are only allowed in Server Actions and Route Handlers -- not
// while rendering a page -- so only actions call these two.

export async function setSessionCookie(token: string): Promise<void> {
    (await cookies()).set(SESSION_COOKIE, token, {
        httpOnly: true, // page JavaScript can't read it, so an XSS bug can't steal it
        sameSite: "lax", // not sent on cross-site POSTs -- blocks CSRF on Server Actions
        secure: process.env.NODE_ENV === "production", // HTTPS-only once deployed
        path: "/",
        // No maxAge on purpose: a browser-session cookie, gone when the browser
        // closes -- sensible on a shared family laptop. Real expiry is enforced
        // by the database (3h idle, sliding), which is the source of truth.
    });
}

export async function clearSessionCookie(): Promise<void> {
    (await cookies()).delete(SESSION_COOKIE);
}
