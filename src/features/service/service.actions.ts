"use server";

// Replaces the old service.api.ts (axios) + ServiceController (NestJS).
// Same thin shape as user.actions.ts:
//   requireUser -> validate with Zod -> call the service -> revalidate -> result
// The Owner-only rule lives in the service, not here.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/_lib/session";
import { invalidInput, toActionError, type ActionResult } from "@/app/_lib/action-result";
import { createService, setServiceActive, updateService } from "@/server/services/service.service";
import { serviceIdSchema, serviceIsActiveSchema, serviceSchema } from "@/server/validators/service";

export async function createServiceAction(input: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();

    const parsed = serviceSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);

    try {
        await createService(db, user, parsed.data);
    } catch (error) {
        return toActionError(error);
    }

    revalidatePath("/services");
    return { ok: true };
}

export async function updateServiceAction(id: unknown, input: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();

    const parsedId = serviceIdSchema.safeParse(id);
    if (!parsedId.success) return invalidInput(parsedId.error);
    const parsed = serviceSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);

    try {
        await updateService(db, user, parsedId.data, parsed.data);
    } catch (error) {
        return toActionError(error);
    }

    revalidatePath("/services");
    return { ok: true };
}

export async function setServiceActiveAction(id: unknown, isActive: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();

    const parsedId = serviceIdSchema.safeParse(id);
    if (!parsedId.success) return invalidInput(parsedId.error);
    const parsedActive = serviceIsActiveSchema.safeParse(isActive);
    if (!parsedActive.success) return invalidInput(parsedActive.error);

    try {
        await setServiceActive(db, user, parsedId.data, parsedActive.data);
    } catch (error) {
        return toActionError(error);
    }

    revalidatePath("/services");
    return { ok: true };
}
