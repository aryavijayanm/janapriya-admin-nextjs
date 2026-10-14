import type { ZodError } from "zod";
import { DomainError } from "@/server/domain/errors";

// What a mutation Server Action returns to its form. A plain object, not a
// thrown error: errors thrown from a Server Action reach the browser stripped
// of their message in production, so a friendly message has to be returned.

/** The failure half -- identical for every action. */
export type ActionFailure = { ok: false; error: string };

/**
 * Success carries nothing by default (users, services). An action that needs
 * to send something back defines its own success shape, e.g. staff:
 *   { ok: true; id: number } | ActionFailure
 */
export type ActionResult = { ok: true } | ActionFailure;

/**
 * Translates an expected business failure (wrong role, duplicate username,
 * "you cannot disable yourself", record not found...) into a message for the
 * form. Anything else -- database down, a bug -- is rethrown so it surfaces as
 * a real error instead of being dressed up as a validation message.
 *
 * Written once for every feature's actions.
 */
export function toActionError(error: unknown): ActionFailure {
    if (error instanceof DomainError) return { ok: false, error: error.message };
    throw error;
}

/** Failed Zod validation -> the first problem's message, for the form. */
export function invalidInput(error: ZodError): ActionFailure {
    return { ok: false, error: error.issues[0]?.message ?? "Invalid input" };
}
