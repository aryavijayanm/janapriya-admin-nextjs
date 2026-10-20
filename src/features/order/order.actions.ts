"use server";

// Same thin shape as every other module's actions:
//   requireUser -> validate with Zod -> call the service -> refresh -> result
// The branch rule, duty checks and contract-date recalculation all live in
// order.service, not here.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/_lib/session";
import { invalidInput, toActionError, type ActionFailure } from "@/app/_lib/action-result";
import {
    cancelDuty,
    createOrder,
    editDuty,
    listAssignableStaff,
    startCare,
    startNextContract,
    updateContractMoney,
    updateDuty,
    updateOrder,
    type AssignableStaff,
} from "@/server/services/order.service";
import {
    contractIdSchema,
    contractMoneySchema,
    dutyIdSchema,
    editDutySchema,
    orderIdSchema,
    orderSchema,
    staffPickerQuerySchema,
    startCareSchema,
    updateDutySchema,
} from "@/server/validators/order";

/** Every order save returns the order's code, so the screen can show /orders/<code>. */
export type OrderSaveResult = { ok: true; code: string } | ActionFailure;

/**
 * An order change can show up on any order page AND on its customer's page
 * (which lists their orders). "layout" refreshes the path and everything
 * under it: /orders, /orders/K7QT, /customer, /customer/42, ...
 */
function refreshOrderPages() {
    revalidatePath("/orders", "layout");
    revalidatePath("/customer", "layout");
}

/**
 * Runs a service call that returns { code }, turning expected failures into
 * a message for the form. Every mutation below ends the same way, so it's
 * written once here.
 */
async function save(run: () => Promise<{ code: string }>): Promise<OrderSaveResult> {
    let code: string;
    try {
        ({ code } = await run());
    } catch (error) {
        return toActionError(error);
    }
    refreshOrderPages();
    return { ok: true, code };
}

// Arguments are `unknown`: a Server Action is a public endpoint, so the
// browser can send anything. Zod turns it into trusted, typed data.

export async function createOrderAction(input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => createOrder(db, user, parsed.data));
}

export async function updateOrderAction(orderId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => updateOrder(db, user, id.data, parsed.data));
}

export async function startCareAction(orderId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    const parsed = startCareSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => startCare(db, user, id.data, parsed.data));
}

export async function updateDutyAction(orderId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    const parsed = updateDutySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => updateDuty(db, user, id.data, parsed.data));
}

export async function editDutyAction(orderId: unknown, dutyId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const oId = orderIdSchema.safeParse(orderId);
    if (!oId.success) return invalidInput(oId.error);
    const dId = dutyIdSchema.safeParse(dutyId);
    if (!dId.success) return invalidInput(dId.error);
    const parsed = editDutySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => editDuty(db, user, oId.data, dId.data, parsed.data));
}

export async function cancelDutyAction(orderId: unknown, dutyId: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const oId = orderIdSchema.safeParse(orderId);
    if (!oId.success) return invalidInput(oId.error);
    const dId = dutyIdSchema.safeParse(dutyId);
    if (!dId.success) return invalidInput(dId.error);
    return save(() => cancelDuty(db, user, oId.data, dId.data));
}

export async function startNextContractAction(orderId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    const parsed = contractMoneySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => startNextContract(db, user, id.data, parsed.data));
}

export async function updateContractMoneyAction(contractId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = contractIdSchema.safeParse(contractId);
    if (!id.success) return invalidInput(id.error);
    const parsed = contractMoneySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => updateContractMoney(db, user, id.data, parsed.data));
}

/** The staff picker's search, called while typing. Reads only -- nothing to refresh. */
export async function searchAssignableStaffAction(
    query: unknown,
): Promise<{ ok: true; staff: AssignableStaff[] } | ActionFailure> {
    const { db, user } = await requireUser();
    const parsed = staffPickerQuerySchema.safeParse(query);
    if (!parsed.success) return invalidInput(parsed.error);
    try {
        return { ok: true, staff: await listAssignableStaff(db, user, parsed.data) };
    } catch (error) {
        return toActionError(error);
    }
}
