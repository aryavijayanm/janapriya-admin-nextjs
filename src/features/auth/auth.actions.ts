"use server";

// Replaces the old auth.api.ts (axios -> NestJS). "use server" turns every
// exported async function here into an endpoint the browser can call; Next.js
// handles the request plumbing that axios + a controller used to do.
//
// Every action has the same thin shape:
//   validate with Zod -> call the service -> handle the cookie -> return/redirect
// No business logic here: that lives in auth.service, which knows nothing
// about forms, cookies or redirects.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/server/db/client";
import { AuthError } from "@/server/domain/errors";
import { login, logout } from "@/server/services/auth.service";
import { loginSchema } from "@/server/validators/auth";
import { SESSION_COOKIE, clearSessionCookie, setSessionCookie } from "@/app/_lib/session";

// Exporting a type is fine from a "use server" file -- types vanish at compile
// time. Exporting a constant or a non-async function is not allowed.
export type LoginState = { error: string | null };

export async function loginAction(
    _previousState: LoginState,
    formData: FormData,
): Promise<LoginState> {
    // Never trust FormData: even with `required` on the inputs, anyone can POST
    // straight to this action without the form.
    const parsed = loginSchema.safeParse({
        username: formData.get("username"),
        password: formData.get("password"),
    });
    if (!parsed.success) {
        return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
    }

    try {
        const { token } = await login(db, parsed.data);
        await setSessionCookie(token);
    } catch (error) {
        // Expected failure -> a message on the form. Anything else (database
        // down, a bug) is rethrown so it surfaces as a real error, not as a
        // misleading "invalid password".
        if (error instanceof AuthError) return { error: error.message };
        throw error;
    }

    // Outside the try on purpose: redirect() works by throwing a special
    // signal, which the catch above would otherwise swallow.
    redirect("/dashboard");
}

export async function logoutAction(): Promise<void> {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    // Delete the server-side row first -- that's what actually ends the
    // session. Clearing the cookie alone (all a JWT logout can do) would leave
    // the token valid for anyone who had copied it.
    if (token) await logout(db, token);
    await clearSessionCookie();
    redirect("/login");
}
