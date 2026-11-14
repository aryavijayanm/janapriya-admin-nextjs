"use server";

// The accounts book's actions. Same thin shape as every other feature:
//   requireUser -> validate with Zod -> call the service -> revalidate -> result
// The rules (who may, no future dates, only ACTIVE entries) live in
// account-book.service, so they hold however the service is reached.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/_lib/session";
import { invalidInput, toActionError, type ActionFailure, type ActionResult } from "@/app/_lib/action-result";
import {
    addAccountEntry,
    deleteAccountEntry,
    getAccountBookForExport,
    updateAccountEntry,
} from "@/server/services/account-book.service";
import { buildAccountBookXlsx } from "@/server/services/account-book-excel";
import { accountEntryIdSchema, accountEntrySchema, accountExportSchema } from "@/server/validators/account-book";

/** Runs one change and refreshes the book. */
async function bookChange(run: () => Promise<unknown>): Promise<ActionResult> {
    try {
        await run();
    } catch (error) {
        return toActionError(error);
    }
    revalidatePath("/accounts");
    return { ok: true };
}

export async function addAccountEntryAction(input: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();
    const parsed = accountEntrySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return bookChange(() => addAccountEntry(db, user, parsed.data));
}

export async function updateAccountEntryAction(entryId: unknown, input: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();
    const id = accountEntryIdSchema.safeParse(entryId);
    if (!id.success) return invalidInput(id.error);
    const parsed = accountEntrySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return bookChange(() => updateAccountEntry(db, user, id.data, parsed.data));
}

export async function deleteAccountEntryAction(entryId: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();
    const id = accountEntryIdSchema.safeParse(entryId);
    if (!id.success) return invalidInput(id.error);
    return bookChange(() => deleteAccountEntry(db, user, id.data));
}

/**
 * Owner's Excel download. The file comes back inside the action's answer (as
 * base64 text) and the browser saves it -- so loading and error messages work
 * exactly like every other button, instead of the browser opening an error page.
 */
export async function exportAccountBookAction(
    range: unknown,
): Promise<{ ok: true; fileName: string; base64: string } | ActionFailure> {
    const { db, user } = await requireUser();
    const parsed = accountExportSchema.safeParse(range);
    if (!parsed.success) return invalidInput(parsed.error);
    try {
        const rows = await getAccountBookForExport(db, user, parsed.data);
        const file = await buildAccountBookXlsx(rows, parsed.data);
        return {
            ok: true,
            fileName: `accounts-book_${parsed.data.from}_to_${parsed.data.to}.xlsx`,
            base64: file.toString("base64"),
        };
    } catch (error) {
        return toActionError(error);
    }
}
