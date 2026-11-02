"use client";

import { useCallback, useState } from "react";
import { unstable_rethrow } from "next/navigation";

/** Shown when the server can't be reached (no internet, server down, timeout). */
export const NETWORK_ERROR_MESSAGE =
    "Couldn't reach the server. Check your internet connection and try again.";

/** What run() returns when the request never arrived. */
export type NetworkFailure = { ok: false; error: string };

/**
 * The one way forms and buttons call Server Actions. Instead of every form
 * keeping its own "saving..." flag, error message and try/finally, it does:
 *
 *   const { run, isPending, error, setError } = useServerAction();
 *   const result = await run(() => saveThingAction(id, payload));
 *   if (result.ok) onClose();
 *
 * run():
 *   - sets isPending while the call is in flight (for the spinner)
 *   - clears the previous error, and shows the server's message when the
 *     action answers { ok: false, error }
 *   - when the request never arrives (Wi-Fi dropped, server restarting) the
 *     call THROWS; that becomes NETWORK_ERROR_MESSAGE in `error` -- so the
 *     user always sees what happened, inside the form
 *   - passes Next.js's own signals through untouched (e.g. the redirect to
 *     /login when the session has expired)
 *
 * It takes the call, not a fixed action, so one form can call different
 * actions (create or update, save or confirm).
 * setError is for the form's own checks before calling (Zod validation).
 */
export function useServerAction() {
    const [isPending, setIsPending] = useState(false);
    const [error, setError] = useState("");

    const run = useCallback(async <R,>(call: () => Promise<R>): Promise<R | NetworkFailure> => {
        setError("");
        setIsPending(true);
        try {
            const result = await call();
            // Results like { ok: false, duplicates } carry no message -- the form handles those.
            if (isFailureWithMessage(result)) setError(result.error);
            return result;
        } catch (thrown) {
            unstable_rethrow(thrown);
            console.error("Server action failed:", thrown);
            setError(NETWORK_ERROR_MESSAGE);
            return { ok: false, error: NETWORK_ERROR_MESSAGE };
        } finally {
            setIsPending(false);
        }
    }, []);

    return { run, isPending, error, setError };
}

function isFailureWithMessage(result: unknown): result is { ok: false; error: string } {
    return (
        typeof result === "object" &&
        result !== null &&
        (result as { ok?: unknown }).ok === false &&
        typeof (result as { error?: unknown }).error === "string"
    );
}
