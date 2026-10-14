"use server";

// Replaces the old user.api.ts (axios) + UserController (NestJS). Each action
// has the same thin shape:
//   requireUser -> validate with Zod -> call the service -> revalidate -> result
// No business logic and no role check here: the service does both, so the
// rules hold no matter who calls the service.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/_lib/session";
import { invalidInput, toActionError, type ActionResult } from "@/app/_lib/action-result";
import { createUser, setUserActive, updateUser } from "@/server/services/user.service";
import {
    createUserSchema,
    isActiveSchema,
    updateUserSchema,
    userIdSchema,
} from "@/server/validators/user";

// Arguments are typed `unknown` on purpose: a Server Action is a public
// endpoint, so whatever the TypeScript signature says, the browser can send
// anything. Zod is what turns `unknown` into trusted, typed data.

export async function createUserAction(input: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();

    const parsed = createUserSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);

    try {
        await createUser(db, user, parsed.data);
    } catch (error) {
        return toActionError(error);
    }

    // Re-renders /users on the server; the fresh list arrives in UserTable
    // as new props in this same response -- no separate reload request.
    revalidatePath("/users");
    return { ok: true };
}

export async function updateUserAction(id: unknown, input: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();

    const parsedId = userIdSchema.safeParse(id);
    if (!parsedId.success) return invalidInput(parsedId.error);
    const parsed = updateUserSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);

    try {
        await updateUser(db, user, parsedId.data, parsed.data);
    } catch (error) {
        return toActionError(error);
    }

    revalidatePath("/users");
    return { ok: true };
}

export async function setUserActiveAction(id: unknown, isActive: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();

    const parsedId = userIdSchema.safeParse(id);
    if (!parsedId.success) return invalidInput(parsedId.error);
    const parsedActive = isActiveSchema.safeParse(isActive);
    if (!parsedActive.success) return invalidInput(parsedActive.error);

    try {
        await setUserActive(db, user, parsedId.data, parsedActive.data);
    } catch (error) {
        return toActionError(error);
    }

    revalidatePath("/users");
    return { ok: true };
}
