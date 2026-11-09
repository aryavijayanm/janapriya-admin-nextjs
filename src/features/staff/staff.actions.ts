"use server";

// Replaces the old staff.api.ts (axios) + StaffController (NestJS). Same thin
// shape as the user and service actions:
//   requireUser -> validate with Zod -> call the service -> revalidate -> result
// The one new job here is unpacking the uploaded photo from FormData into
// plain bytes, so the service never deals with browser File objects.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/_lib/session";
import {
    invalidInput,
    toActionError,
    type ActionFailure,
    type ActionResult,
} from "@/app/_lib/action-result";
import {
    createStaff,
    setStaffStatus,
    updateStaff,
    type PossibleDuplicateStaff,
    type SaveStaffResult,
} from "@/server/services/staff.service";
import type { PhotoUpload } from "@/server/services/staff-photo";
import { staffIdSchema, staffSchema, staffStatusSchema } from "@/server/validators/staff";
import { addStaffEntry, clearStaffSalary, voidStaffEntry } from "@/server/services/staff-account.service";
import { refreshStaffBalanceQuietly } from "@/server/services/staff-balance.service";
import { refreshBalancePages } from "@/app/_lib/staff-balance-pages";
import type { Db } from "@/server/db/client";
import {
    clearSalarySchema,
    staffEntryIdSchema,
    staffEntrySchema,
    voidStaffEntrySchema,
} from "@/server/validators/staff-account";

/**
 * Three outcomes (same as customers):
 *   { ok: true, id }          saved -- go to that person's details page
 *   { ok: false, error }      something wrong -- show the message
 *   { ok: false, duplicates } NOT saved yet -- show the warning, let the user decide
 */
export type StaffSaveResult =
    | { ok: true; id: number }
    | ActionFailure
    | { ok: false; duplicates: PossibleDuplicateStaff[] };

/** "Continue anyway" on the duplicate warning: the form sends confirmDuplicate=true. */
function readConfirmDuplicate(formData: FormData): boolean {
    return formData.get("confirmDuplicate") === "true";
}

function toSaveResult(result: SaveStaffResult): StaffSaveResult {
    return result.kind === "possibleDuplicates"
        ? { ok: false, duplicates: result.duplicates }
        : { ok: true, id: result.staff.id };
}

/** The form's text fields arrive as one JSON string inside the FormData. */
function parseStaffData(formData: FormData) {
    let raw: unknown;
    try {
        raw = JSON.parse(String(formData.get("data") ?? ""));
    } catch {
        raw = null; // not JSON -> fails validation below with a normal message
    }
    return staffSchema.safeParse(raw);
}

/** The uploaded photo as plain bytes, or null when no file was chosen. */
async function readPhoto(formData: FormData): Promise<PhotoUpload | null> {
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) return null;
    return { bytes: Buffer.from(await file.arrayBuffer()), type: file.type };
}

export async function createStaffAction(formData: FormData): Promise<StaffSaveResult> {
    const { db, user } = await requireUser();

    const parsed = parseStaffData(formData);
    if (!parsed.success) return invalidInput(parsed.error);

    let result: SaveStaffResult;
    try {
        result = await createStaff(db, user, parsed.data, await readPhoto(formData), {
            confirmDuplicate: readConfirmDuplicate(formData),
        });
    } catch (error) {
        return toActionError(error);
    }

    // Only refresh when something was actually saved.
    if (result.kind === "saved") revalidatePath("/staff");
    return toSaveResult(result);
}

export async function updateStaffAction(staffId: unknown, formData: FormData): Promise<StaffSaveResult> {
    const { db, user } = await requireUser();

    const parsedId = staffIdSchema.safeParse(staffId);
    if (!parsedId.success) return invalidInput(parsedId.error);
    const parsed = parseStaffData(formData);
    if (!parsed.success) return invalidInput(parsed.error);

    let result: SaveStaffResult;
    try {
        result = await updateStaff(
            db,
            user,
            parsedId.data,
            parsed.data,
            { upload: await readPhoto(formData), remove: formData.get("removePhoto") === "true" },
            { confirmDuplicate: readConfirmDuplicate(formData) },
        );
    } catch (error) {
        return toActionError(error);
    }

    if (result.kind === "saved") {
        // The list and this person's details page both show this record, so
        // both are refreshed. (The edit page reads fresh data each time.)
        revalidatePath("/staff");
        revalidatePath(`/staff/${parsedId.data}`);
    }
    return toSaveResult(result);
}

// --- Staff account (rules in staff-account.service) ------------------------

/**
 * Every staff-account change refreshes that staff member's account page,
 * their stored balance (the balances look-up) and the pages showing it.
 */
async function accountChange(db: Db, staffId: number, run: () => Promise<unknown>): Promise<ActionResult> {
    try {
        await run();
    } catch (error) {
        return toActionError(error);
    }
    await refreshStaffBalanceQuietly(db, staffId);
    revalidatePath(`/staff/${staffId}/account`);
    refreshBalancePages();
    return { ok: true };
}

export async function addStaffEntryAction(staffId: unknown, input: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();
    const id = staffIdSchema.safeParse(staffId);
    if (!id.success) return invalidInput(id.error);
    const parsed = staffEntrySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return accountChange(db, id.data, () => addStaffEntry(db, user, id.data, parsed.data));
}

export async function voidStaffEntryAction(staffId: unknown, entryId: unknown, input: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();
    const sId = staffIdSchema.safeParse(staffId);
    if (!sId.success) return invalidInput(sId.error);
    const eId = staffEntryIdSchema.safeParse(entryId);
    if (!eId.success) return invalidInput(eId.error);
    const parsed = voidStaffEntrySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return accountChange(db, sId.data, () => voidStaffEntry(db, user, eId.data, parsed.data.reason));
}

export async function clearStaffSalaryAction(staffId: unknown, input: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();
    const id = staffIdSchema.safeParse(staffId);
    if (!id.success) return invalidInput(id.error);
    const parsed = clearSalarySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return accountChange(db, id.data, () => clearStaffSalary(db, user, id.data, parsed.data));
}

export async function setStaffStatusAction(staffId: unknown, status: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();

    const parsedId = staffIdSchema.safeParse(staffId);
    if (!parsedId.success) return invalidInput(parsedId.error);
    const parsedStatus = staffStatusSchema.safeParse(status);
    if (!parsedStatus.success) return invalidInput(parsedStatus.error);

    try {
        await setStaffStatus(db, user, parsedId.data, parsedStatus.data);
    } catch (error) {
        return toActionError(error);
    }

    revalidatePath("/staff");
    revalidatePath(`/staff/${parsedId.data}`);
    return { ok: true };
}
