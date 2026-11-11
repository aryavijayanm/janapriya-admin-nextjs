"use server";

// Same thin shape as every other module's actions:
//   requireUser -> validate with Zod -> call the service -> refresh -> result
// The branch rule, duty checks and contract-date recalculation all live in
// order.service, not here.

import { revalidatePath } from "next/cache";
import { requireUser } from "@/app/_lib/session";
import { invalidInput, toActionError, type ActionFailure } from "@/app/_lib/action-result";
import {
    confirmContractRate,
    createOrder,
    deleteLatestContract,
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
    endOrderSchema,
    orderIdSchema,
    orderSchema,
    restartFromSchema,
    staffPickerQuerySchema,
    startCareSchema,
    updateDutySchema,
} from "@/server/validators/order";
import { recordPayment, voidPayment } from "@/server/services/payment.service";
import {
    endOrder,
    recordRefund,
    undoEndOrder,
    writeOffOrder,
    type EndOrderSummary,
} from "@/server/services/order-end.service";
import { withStaffBalanceRefresh } from "@/server/services/staff-balance.service";
import { refreshBalancePages } from "@/app/_lib/staff-balance-pages";
import type { Db } from "@/server/db/client";
import {
    paymentIdSchema,
    paymentSchema,
    refundSchema,
    voidPaymentSchema,
    writeOffSchema,
} from "@/server/validators/payment";

/** Every order save returns the order's code, so the screen can show /orders/<code>. */
export type OrderSaveResult = { ok: true; code: string } | ActionFailure;

/**
 * An order change can show up on any order page AND on its customer's page
 * (which lists their orders). "layout" refreshes the path and everything
 * under it: /orders, /orders/K7QT, /customer, /customer/42, ... The payments
 * table and the dashboard's Payments card read the same contracts.
 */
function refreshOrderPages() {
    revalidatePath("/orders", "layout");
    revalidatePath("/customer", "layout");
    revalidatePath("/payments");
    revalidatePath("/dashboard");
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

/**
 * `save` for changes that move staff money -- duty periods, and contract
 * dates or staff salary: also refreshes the stored balances of the staff on
 * that order (the staff balances look-up).
 */
function saveWithStaffBalances(db: Db, ref: { orderId: number } | { contractId: number }, run: () => Promise<{ code: string }>) {
    return save(async () => {
        const result = await withStaffBalanceRefresh(db, ref, run);
        refreshBalancePages();
        return result;
    });
}

// Arguments are `unknown`: a Server Action is a public endpoint, so the
// browser can send anything. Zod turns it into trusted, typed data.

/** A new order; with `restartFrom` (an ended order's code) it is a Restart of that order. */
export async function createOrderAction(input: unknown, restartFrom: unknown = null): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const parsed = orderSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    const from = restartFromSchema.safeParse(restartFrom);
    if (!from.success) return invalidInput(from.error);
    return save(() => createOrder(db, user, parsed.data, from.data));
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
    return saveWithStaffBalances(db, { orderId: id.data }, () => startCare(db, user, id.data, parsed.data));
}

export async function updateDutyAction(orderId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    const parsed = updateDutySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return saveWithStaffBalances(db, { orderId: id.data }, () => updateDuty(db, user, id.data, parsed.data));
}

export async function editDutyAction(orderId: unknown, dutyId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const oId = orderIdSchema.safeParse(orderId);
    if (!oId.success) return invalidInput(oId.error);
    const dId = dutyIdSchema.safeParse(dutyId);
    if (!dId.success) return invalidInput(dId.error);
    const parsed = editDutySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return saveWithStaffBalances(db, { orderId: oId.data }, () => editDuty(db, user, oId.data, dId.data, parsed.data));
}

export async function startNextContractAction(orderId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    const parsed = contractMoneySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return saveWithStaffBalances(db, { orderId: id.data }, () => startNextContract(db, user, id.data, parsed.data));
}

export async function updateContractMoneyAction(contractId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = contractIdSchema.safeParse(contractId);
    if (!id.success) return invalidInput(id.error);
    const parsed = contractMoneySchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return saveWithStaffBalances(db, { contractId: id.data }, () => updateContractMoney(db, user, id.data, parsed.data));
}

// --- Payments (rules in payment.service) ------------------------------------

export async function recordPaymentAction(contractId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = contractIdSchema.safeParse(contractId);
    if (!id.success) return invalidInput(id.error);
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => recordPayment(db, user, id.data, parsed.data));
}

export async function voidPaymentAction(paymentId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = paymentIdSchema.safeParse(paymentId);
    if (!id.success) return invalidInput(id.error);
    const parsed = voidPaymentSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => voidPayment(db, user, id.data, parsed.data.reason));
}

/** "Rate is correct" on an auto-started contract. */
export async function confirmContractRateAction(contractId: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = contractIdSchema.safeParse(contractId);
    if (!id.success) return invalidInput(id.error);
    return save(() => confirmContractRate(db, user, id.data));
}

export async function deleteContractAction(contractId: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = contractIdSchema.safeParse(contractId);
    if (!id.success) return invalidInput(id.error);
    return saveWithStaffBalances(db, { contractId: id.data }, () => deleteLatestContract(db, user, id.data));
}

// --- End order, Undo end, Refunds (rules in order-end.service) ---------------

/** What "End order" would do -- the same code as saving, rolled back. Reads only. */
export async function previewEndOrderAction(
    orderId: unknown,
    input: unknown,
): Promise<{ ok: true; summary: EndOrderSummary } | ActionFailure> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    const parsed = endOrderSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    try {
        return { ok: true, summary: await endOrder(db, user, id.data, parsed.data, { preview: true }) };
    } catch (error) {
        return toActionError(error);
    }
}

/** Ends the order; it stops the duty on duty, so staff balances are refreshed too. */
export async function endOrderAction(orderId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    const parsed = endOrderSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return saveWithStaffBalances(db, { orderId: id.data }, () => endOrder(db, user, id.data, parsed.data));
}

export async function undoEndOrderAction(orderId: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    return save(() => undoEndOrder(db, user, id.data));
}

export async function recordRefundAction(contractId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = contractIdSchema.safeParse(contractId);
    if (!id.success) return invalidInput(id.error);
    const parsed = refundSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => recordRefund(db, user, id.data, parsed.data));
}

/** Owner only (checked in the service): writes off an ended order's unpaid balance. */
export async function writeOffOrderAction(orderId: unknown, input: unknown): Promise<OrderSaveResult> {
    const { db, user } = await requireUser();
    const id = orderIdSchema.safeParse(orderId);
    if (!id.success) return invalidInput(id.error);
    const parsed = writeOffSchema.safeParse(input);
    if (!parsed.success) return invalidInput(parsed.error);
    return save(() => writeOffOrder(db, user, id.data, parsed.data));
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
