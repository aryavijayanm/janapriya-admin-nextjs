import { z } from "zod";

// Free-text limits, shared by every schema and every form (the text boxes use
// the same numbers as maxLength), so the browser and the server always agree.
// No @prisma/client import: this file ends up in the browser bundle.

/** Remarks on a customer, staff member or order: room for family details. */
export const REMARKS_MAX_LENGTH = 1000;
/** A duty period's stop note ("left early morning", "hospitalised"). */
export const NOTE_MAX_LENGTH = 500;

/**
 * Optional free text with a maximum length: trimmed, "" becomes null.
 * e.g. limitedText(REMARKS_MAX_LENGTH, "Remarks")
 */
export const limitedText = (max: number, label: string) =>
    z
        .string()
        .trim()
        .max(max, `${label} can be at most ${max} characters`)
        .transform((value) => (value === "" ? null : value));
