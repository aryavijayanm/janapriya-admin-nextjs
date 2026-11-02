import "server-only";

import type { Prisma, Role } from "@prisma/client";
import type { Db } from "@/server/db/client";
import { todayInKerala } from "@/server/domain/age";
import { formatDayMonthYear, fromIsoDate, toDayNumber } from "@/server/domain/days";
import { NotFoundError, ValidationError } from "@/server/domain/errors";
import { balanceDue } from "@/server/domain/payments";
import { ALL_ROLES, assertRole, type AuthUser } from "@/server/services/authz";
import { formatRupees } from "@/lib/money";
import {
    getVisibleOrderForUpdate,
    lockContractAndGetPaid,
    recalculatePaymentStatus,
} from "@/server/services/order.service";
import type { PaymentInput } from "@/server/validators/payment";

// Customer payments (step 2). Recording only -- no money moves through the
// app. A payment belongs to ONE contract and is never edited: a mistake is
// voided (kept, crossed out, with who/when/why) and recorded again.
//
// Every change: check the order (branch rule + not ended), lock the contract
// row, validate, write, recalculate the contract's paid status -- all in one
// transaction, so the stored status always matches the payments.

/** Everyone who can open an order may record and void its payments (owner's decision). */
const PAYMENT_MODULE_ROLES: Role[] = [...ALL_ROLES];

/** The contract a payment change is about, with its order already checked. */
async function getContractForPayment(tx: Prisma.TransactionClient, user: AuthUser, contractId: number) {
    const contract = await tx.contract.findUnique({
        where: { id: contractId },
        select: { id: true, orderId: true, contractNumber: true, rate: true },
    });
    if (!contract) throw new NotFoundError("Contract not found");
    // Hidden from this user (OUTSIDER + OUTSIDE order) -> "not found"; ended -> refused.
    const order = await getVisibleOrderForUpdate(tx, user, contract.orderId);
    return { contract, order };
}

export async function recordPayment(
    db: Db,
    user: AuthUser,
    contractId: number,
    input: PaymentInput,
): Promise<{ code: string }> {
    assertRole(user, PAYMENT_MODULE_ROLES);

    const paidOn = fromIsoDate(input.paidOn);
    if (toDayNumber(paidOn) > toDayNumber(fromIsoDate(todayInKerala()))) {
        throw new ValidationError("The paid on date can't be in the future. Record a payment once it's received.");
    }

    return db.$transaction(async (tx) => {
        const { contract, order } = await getContractForPayment(tx, user, contractId);

        const paidAmount = await lockContractAndGetPaid(tx, contractId);
        const due = balanceDue(contract.rate, paidAmount);
        if (due === 0) {
            throw new ValidationError(`Contract #${contract.contractNumber} is already fully paid`);
        }
        // Every rupee belongs to exactly one contract: split a bigger payment
        // across contracts instead.
        if (input.amount > due) {
            throw new ValidationError(
                `Only ${formatRupees(due)} is due on #${contract.contractNumber}. ` +
                    `Record the extra ${formatRupees(input.amount - due)} against the next contract.`,
            );
        }

        await tx.payment.create({
            data: {
                contractId,
                amount: input.amount,
                paidOn,
                mode: input.mode,
                accountDetails: input.accountDetails,
                recordedById: user.id,
            },
        });
        await recalculatePaymentStatus(tx, contractId);
        return { code: order.code };
    });
}

/** Cancels a wrong payment. It stays in the history, crossed out, and stops counting. */
export async function voidPayment(
    db: Db,
    user: AuthUser,
    paymentId: number,
    reason: string,
): Promise<{ code: string }> {
    assertRole(user, PAYMENT_MODULE_ROLES);

    return db.$transaction(async (tx) => {
        const payment = await tx.payment.findUnique({
            where: { id: paymentId },
            select: { contractId: true, voidedAt: true, amount: true, paidOn: true },
        });
        if (!payment) throw new NotFoundError("Payment not found");
        const { order } = await getContractForPayment(tx, user, payment.contractId);
        await lockContractAndGetPaid(tx, payment.contractId);

        if (payment.voidedAt !== null) {
            throw new ValidationError(
                `This payment of ${formatRupees(payment.amount)} (${formatDayMonthYear(payment.paidOn)}) is already voided`,
            );
        }

        await tx.payment.update({
            where: { id: paymentId },
            data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason },
        });
        await recalculatePaymentStatus(tx, payment.contractId);
        return { code: order.code };
    });
}
