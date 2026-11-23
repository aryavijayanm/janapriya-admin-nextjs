"use server";

// Server Actions for the payments table. Same thin shape as every action:
// session -> Zod -> service -> refresh the page -> plain result.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/_lib/session";
import { invalidInput, toActionError, type ActionResult } from "@/app/_lib/action-result";
import { markPaymentReminderSent } from "@/server/services/payment.service";
import { contractIdSchema } from "@/server/validators/order";

/** "Mark as sent": records that the WhatsApp reminder for this contract went out. */
export async function markReminderSentAction(contractId: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();
    const id = contractIdSchema.safeParse(contractId);
    if (!id.success) return invalidInput(id.error);

    try {
        await markPaymentReminderSent(db, user, id.data);
    } catch (error) {
        return toActionError(error);
    }
    // The row swaps the button for "Reminder sent ... · <name>".
    revalidatePath("/payments");
    return { ok: true };
}
