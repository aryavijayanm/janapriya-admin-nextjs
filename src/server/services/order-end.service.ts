import "server-only";

import type { Prisma, Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { todayInKerala } from "@/server/domain/age";
import { formatDayMonthYear, fromIsoDate, toDayNumber } from "@/server/domain/days";
import { endedContractOutcome } from "@/server/domain/end-order";
import { NotFoundError, ValidationError } from "@/server/domain/errors";
import { balanceDue, contractAmountDue, refundDue } from "@/server/domain/payments";
import { formatRupees } from "@/lib/money";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import {
    getVisibleOrderForUpdate,
    lockContractAndGetPaid,
    recalculateContracts,
    recalculatePaymentStatus,
} from "@/server/services/order.service";
import type { EndOrderInput } from "@/server/validators/order";
import type { RefundInput } from "@/server/validators/payment";

// End order, Undo end and Refunds (step 2).
//
// End order, in ONE transaction:
//   1. someone on duty -> their duty stops on the last day, with the exit day
//      part the user chose; nobody on duty -> the order ends on the last duty day
//   2. contract dates and served days are recalculated (as on every duty change)
//   3. every contract is charged for its served days (rate / 28 x days, rounded
//      down); a contract with 0 served days and no payment rows is removed
//   4. paid status is recalculated against the charge; the order gets its end date
// Paid more than the charge -> "refund due"; less -> the customer still has to pay.
//
// The preview runs the very same code and then rolls the transaction back, so
// what the dialog shows is exactly what saving does.

type Tx = Prisma.TransactionClient;

/** Everyone may end orders and record refunds (owner's decision); the branch rule applies. */
const END_ORDER_ROLES: Role[] = [...ALL_ROLES];

function todayDay(): number {
    return toDayNumber(fromIsoDate(todayInKerala()));
}

/** One contract in the End order preview / result. */
export interface EndedContractSummary {
    contractNumber: number;
    servedDays: number;
    rate: number;
    /** What the customer is charged for the days served. */
    charge: number;
    paid: number;
    /** We give back (paid more than the charge). */
    refund: number;
    /** The customer still has to pay (paid less than the charge). */
    stillToPay: number;
}

export interface EndOrderSummary {
    code: string;
    endDate: Date;
    /** The staff member whose duty was stopped by this (null = nobody was on duty). */
    stoppedStaff: string | null;
    contracts: EndedContractSummary[];
    /** Contract numbers removed (not started, never paid). */
    removed: number[];
    totalRefund: number;
    totalStillToPay: number;
}

/** Thrown inside the transaction to roll the preview back, carrying its result out. */
class PreviewRollback extends Error {
    constructor(readonly summary: EndOrderSummary) {
        super("End order preview");
    }
}

/** The last day of care: the stop day when someone is on duty, else the last duty day. */
async function endTheDuty(tx: Tx, orderId: number, input: EndOrderInput): Promise<{ endDate: Date; stoppedStaff: string | null }> {
    const open = await tx.staffAssignment.findFirst({
        where: { orderId, endDate: null },
        include: { staff: { select: { name: true } } },
    });

    if (open) {
        if (!input.lastDay || !input.exitDayPart) {
            throw new ValidationError(`${open.staff.name} is on duty. Please enter the last day and choose No pay, Half day or Full day.`);
        }
        const lastDay = fromIsoDate(input.lastDay);
        if (toDayNumber(lastDay) > todayDay()) {
            throw new ValidationError("The last day of care can't be in the future. End the order once care has stopped.");
        }
        if (toDayNumber(lastDay) < toDayNumber(open.startDate)) {
            throw new ValidationError(
                `The last day can't be before ${open.staff.name} started (${formatDayMonthYear(open.startDate)})`,
            );
        }
        await tx.staffAssignment.update({
            where: { id: open.id },
            data: { endDate: lastDay, endDayPart: input.exitDayPart },
        });
        return { endDate: lastDay, stoppedStaff: open.staff.name };
    }

    // Nobody on duty: care stopped on the last duty day. A later end date would
    // suggest days were used that weren't, so it's refused.
    const last = await tx.staffAssignment.findFirst({
        where: { orderId },
        orderBy: { endDate: "desc" },
        select: { endDate: true },
    });
    if (!last?.endDate) {
        // Care never started: the order simply ends today, with nothing to charge.
        return { endDate: fromIsoDate(todayInKerala()), stoppedStaff: null };
    }
    if (input.lastDay && toDayNumber(fromIsoDate(input.lastDay)) !== toDayNumber(last.endDate)) {
        throw new ValidationError(
            `The last duty day is ${formatDayMonthYear(last.endDate)}. The order can't end on another day.`,
        );
    }
    return { endDate: last.endDate, stoppedStaff: null };
}

/** Charges every contract for its served days (or removes it); returns the summary. */
async function chargeContracts(tx: Tx, orderId: number, endDate: Date) {
    const contracts = await tx.contract.findMany({
        where: { orderId },
        orderBy: { contractNumber: "asc" },
        select: { id: true, contractNumber: true, rate: true, servedDays: true, endDate: true, _count: { select: { payments: true } } },
    });

    const removed: number[] = [];
    const kept: { id: number; contractNumber: number }[] = [];
    for (const c of contracts) {
        const outcome = endedContractOutcome({ rate: c.rate, servedDays: c.servedDays, paymentRows: c._count.payments });
        if (outcome.kind === "remove") {
            await tx.contract.delete({ where: { id: c.id } });
            removed.push(c.contractNumber);
            continue;
        }
        await tx.contract.update({
            where: { id: c.id },
            // A contract still "running" gets the order's last day as its end.
            data: { charge: outcome.charge, ...(c.endDate === null && c.servedDays > 0 ? { endDate } : {}) },
        });
        await recalculatePaymentStatus(tx, c.id);
        kept.push(c);
    }

    const after = await tx.contract.findMany({
        where: { id: { in: kept.map((c) => c.id) } },
        orderBy: { contractNumber: "asc" },
        select: { contractNumber: true, servedDays: true, rate: true, charge: true, paidAmount: true, refundedAmount: true },
    });
    const summaries: EndedContractSummary[] = after.map((c) => ({
        contractNumber: c.contractNumber,
        servedDays: c.servedDays,
        rate: c.rate,
        charge: c.charge ?? c.rate,
        paid: c.paidAmount,
        refund: refundDue(c),
        stillToPay: balanceDue(contractAmountDue(c), c.paidAmount),
    }));
    return { summaries, removed };
}

/**
 * "End order" -- or, with `preview`, exactly what it would do, without saving.
 * Refused for an order that has already ended (getVisibleOrderForUpdate).
 */
export async function endOrder(
    db: Db,
    user: AuthUser,
    orderId: number,
    input: EndOrderInput,
    { preview = false } = {},
): Promise<EndOrderSummary> {
    assertRole(user, END_ORDER_ROLES);

    try {
        return await db.$transaction(async (tx) => {
            const order = await getVisibleOrderForUpdate(tx, user, orderId);

            const { endDate, stoppedStaff } = await endTheDuty(tx, orderId, input);
            await recalculateContracts(tx, orderId);
            const { summaries, removed } = await chargeContracts(tx, orderId, endDate);
            await tx.customerOrder.update({ where: { id: orderId }, data: { endDate, endNote: input.endNote } });

            const summary: EndOrderSummary = {
                code: order.code,
                endDate,
                stoppedStaff,
                contracts: summaries,
                removed,
                totalRefund: summaries.reduce((sum, c) => sum + c.refund, 0),
                totalStillToPay: summaries.reduce((sum, c) => sum + c.stillToPay, 0),
            };
            if (preview) throw new PreviewRollback(summary); // undo everything above
            return summary;
        });
    } catch (error) {
        if (error instanceof PreviewRollback) return error.summary;
        throw error;
    }
}

/**
 * "Undo end": for an order ended by mistake -- only while no refund has been
 * given (money already returned can't be un-returned) and it hasn't been
 * restarted. Charges are cleared and paid status goes back to the full rate.
 * The stopped duty stays stopped (start someone again with Update duty);
 * removed contracts are not brought back -- the next one is created again
 * when due (nightly job or the button).
 */
export async function undoEndOrder(db: Db, user: AuthUser, orderId: number): Promise<{ code: string }> {
    assertRole(user, END_ORDER_ROLES);

    return db.$transaction(async (tx) => {
        const order = await getVisibleOrderForUpdate(tx, user, orderId, { allowEnded: true });
        const details = await tx.customerOrder.findUniqueOrThrow({
            where: { id: orderId },
            select: {
                restartedAs: { select: { code: true } },
                contracts: { select: { id: true, refundedAmount: true } },
            },
        });
        if (order.endDate === null) throw new ValidationError("This order hasn't ended");
        if (details.restartedAs) {
            throw new ValidationError(`This order was restarted as ${details.restartedAs.code}, so it can't be reopened`);
        }
        if (details.contracts.some((c) => c.refundedAmount > 0)) {
            throw new ValidationError("A refund was already given on this order, so the end can't be undone");
        }

        await tx.customerOrder.update({ where: { id: orderId }, data: { endDate: null, endNote: null } });
        await tx.contract.updateMany({ where: { orderId }, data: { charge: null } });
        await recalculateContracts(tx, orderId);
        for (const c of details.contracts) await recalculatePaymentStatus(tx, c.id);
        return { code: order.code };
    });
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

/** Total of the refunds that count, stored on the contract (like paidAmount). */
async function recalculateRefunded(tx: Tx, contractId: number) {
    const sum = await tx.refund.aggregate({ where: { contractId, voidedAt: null }, _sum: { amount: true } });
    await tx.contract.update({ where: { id: contractId }, data: { refundedAmount: sum._sum.amount ?? 0 } });
}

/** The contract a refund is about, with its (ended) order checked. */
async function getContractForRefund(tx: Tx, user: AuthUser, contractId: number) {
    const contract = await tx.contract.findUnique({ where: { id: contractId }, select: { orderId: true, contractNumber: true } });
    if (!contract) throw new NotFoundError("Contract not found");
    const order = await getVisibleOrderForUpdate(tx, user, contract.orderId, { allowEnded: true });
    if (order.endDate === null) throw new ValidationError("Refunds are recorded after the order ends");
    // Same row lock as payments: a refund and a payment change can't interleave.
    await lockContractAndGetPaid(tx, contractId);
    return { contract, order };
}

/** "Record refund": money given back -- never more than the refund due. */
export async function recordRefund(db: Db, user: AuthUser, contractId: number, input: RefundInput): Promise<{ code: string }> {
    assertRole(user, END_ORDER_ROLES);
    const refundedOn = fromIsoDate(input.refundedOn);
    if (toDayNumber(refundedOn) > todayDay()) {
        throw new ValidationError("The refund date can't be in the future. Record a refund once it's given.");
    }

    return db.$transaction(async (tx) => {
        const { contract, order } = await getContractForRefund(tx, user, contractId);
        const fresh = await tx.contract.findUniqueOrThrow({
            where: { id: contractId },
            select: { charge: true, paidAmount: true, refundedAmount: true },
        });
        const due = refundDue(fresh);
        if (due === 0) throw new ValidationError(`No refund is due on #${contract.contractNumber}`);
        if (input.amount > due) {
            throw new ValidationError(`Only ${formatRupees(due)} is to be refunded on #${contract.contractNumber}. Please check the amount.`);
        }

        await tx.refund.create({
            data: {
                contractId,
                amount: input.amount,
                refundedOn,
                mode: input.mode,
                accountDetails: input.accountDetails,
                remarks: input.remarks,
                recordedById: user.id,
            },
        });
        await recalculateRefunded(tx, contractId);
        return { code: order.code };
    });
}

/** Cancels a wrong refund. It stays in the history, crossed out, and stops counting. */
export async function voidRefund(db: Db, user: AuthUser, refundId: number, reason: string): Promise<{ code: string }> {
    assertRole(user, END_ORDER_ROLES);

    return db.$transaction(async (tx) => {
        const refund = await tx.refund.findUnique({ where: { id: refundId }, select: { contractId: true, voidedAt: true } });
        if (!refund) throw new NotFoundError("Refund not found");
        const { order } = await getContractForRefund(tx, user, refund.contractId);
        if (refund.voidedAt !== null) throw new ValidationError("This refund is already voided");

        await tx.refund.update({ where: { id: refundId }, data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason } });
        await recalculateRefunded(tx, refund.contractId);
        return { code: order.code };
    });
}
