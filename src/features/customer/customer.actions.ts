"use server";

// Same thin shape as the staff and user actions:
//   requireUser -> validate with Zod -> call the service -> revalidate -> result
// The duplicate rule and the role check live in customer.service, not here.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/_lib/session";
import {
    invalidInput,
    toActionError,
    type ActionFailure,
    type ActionResult,
} from "@/app/_lib/action-result";
import {
    createCustomer,
    searchActiveCustomers,
    setCustomerStatus,
    updateCustomer,
    type CustomerOption,
    type PossibleDuplicate,
    type SaveCustomerResult,
} from "@/server/services/customer.service";
import {
    confirmDuplicateSchema,
    customerIdSchema,
    customerSchema,
    customerSearchSchema,
    customerStatusSchema,
} from "@/server/validators/customer";

/**
 * Three outcomes:
 *   { ok: true, id }          saved -- go to the customer's page
 *   { ok: false, error }      something wrong -- show the message
 *   { ok: false, duplicates } NOT saved yet -- show the warning, let the user decide
 */
export type CustomerSaveResult =
    | { ok: true; id: number }
    | ActionFailure
    | { ok: false; duplicates: PossibleDuplicate[] };

/** Turns the service's result into what the form receives. */
function toSaveResult(result: SaveCustomerResult): CustomerSaveResult {
    return result.kind === "possibleDuplicates"
        ? { ok: false, duplicates: result.duplicates }
        : { ok: true, id: result.customer.id };
}

// Arguments are `unknown`: a Server Action is a public endpoint, so the
// browser can send anything. Zod turns it into trusted, typed data.

export async function createCustomerAction(input: unknown, confirmDuplicate: unknown): Promise<CustomerSaveResult> {
    const { db, user } = await requireUser();

    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const confirm = confirmDuplicateSchema.safeParse(confirmDuplicate);
    if (!confirm.success) return invalidInput(confirm.error);

    let result: SaveCustomerResult;
    try {
        result = await createCustomer(db, user, parsed.data, { confirmDuplicate: confirm.data });
    } catch (error) {
        return toActionError(error);
    }

    // Only refresh when something was actually saved.
    if (result.kind === "saved") revalidatePath("/customer");
    return toSaveResult(result);
}

export async function updateCustomerAction(
    customerId: unknown,
    input: unknown,
    confirmDuplicate: unknown,
): Promise<CustomerSaveResult> {
    const { db, user } = await requireUser();

    const parsedId = customerIdSchema.safeParse(customerId);
    if (!parsedId.success) return invalidInput(parsedId.error);
    const parsed = customerSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const confirm = confirmDuplicateSchema.safeParse(confirmDuplicate);
    if (!confirm.success) return invalidInput(confirm.error);

    let result: SaveCustomerResult;
    try {
        result = await updateCustomer(db, user, parsedId.data, parsed.data, { confirmDuplicate: confirm.data });
    } catch (error) {
        return toActionError(error);
    }

    if (result.kind === "saved") {
        // The list and this customer's details page both show this record.
        revalidatePath("/customer");
        revalidatePath(`/customer/${parsedId.data}`);
    }
    return toSaveResult(result);
}

/** Active customers matching what's typed -- for pickers. Reads only. */
export async function searchActiveCustomersAction(
    search: unknown,
): Promise<{ ok: true; customers: CustomerOption[] } | ActionFailure> {
    const { db, user } = await requireUser();
    const parsed = customerSearchSchema.safeParse(search);
    if (!parsed.success) return invalidInput(parsed.error);
    try {
        return { ok: true, customers: await searchActiveCustomers(db, user, parsed.data) };
    } catch (error) {
        return toActionError(error);
    }
}

export async function setCustomerStatusAction(customerId: unknown, status: unknown): Promise<ActionResult> {
    const { db, user } = await requireUser();

    const parsedId = customerIdSchema.safeParse(customerId);
    if (!parsedId.success) return invalidInput(parsedId.error);
    const parsedStatus = customerStatusSchema.safeParse(status);
    if (!parsedStatus.success) return invalidInput(parsedStatus.error);

    try {
        await setCustomerStatus(db, user, parsedId.data, parsedStatus.data);
    } catch (error) {
        return toActionError(error);
    }

    revalidatePath("/customer");
    revalidatePath(`/customer/${parsedId.data}`);
    return { ok: true };
}
