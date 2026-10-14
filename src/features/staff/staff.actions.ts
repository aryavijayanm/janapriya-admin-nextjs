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
import { createStaff, setStaffStatus, updateStaff } from "@/server/services/staff.service";
import type { PhotoUpload } from "@/server/services/staff-photo";
import { staffIdSchema, staffSchema, staffStatusSchema } from "@/server/validators/staff";

/** Staff saves return the id, so the form can go to that person's details page. */
export type StaffSaveResult = { ok: true; id: number } | ActionFailure;

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

    let id: number;
    try {
        const staff = await createStaff(db, user, parsed.data, await readPhoto(formData));
        id = staff.id;
    } catch (error) {
        return toActionError(error);
    }

    revalidatePath("/staff");
    return { ok: true, id };
}

export async function updateStaffAction(staffId: unknown, formData: FormData): Promise<StaffSaveResult> {
    const { db, user } = await requireUser();

    const parsedId = staffIdSchema.safeParse(staffId);
    if (!parsedId.success) return invalidInput(parsedId.error);
    const parsed = parseStaffData(formData);
    if (!parsed.success) return invalidInput(parsed.error);

    try {
        await updateStaff(db, user, parsedId.data, parsed.data, {
            upload: await readPhoto(formData),
            remove: formData.get("removePhoto") === "true",
        });
    } catch (error) {
        return toActionError(error);
    }

    // The list and this person's details page both show this record, so both
    // are refreshed. (The edit page reads fresh data each time it's opened.)
    revalidatePath("/staff");
    revalidatePath(`/staff/${parsedId.data}`);
    return { ok: true, id: parsedId.data };
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
