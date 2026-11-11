// The paid-status rule for one contract, as pure functions: no database, no
// Next.js. The stored Contract.paymentStatus / paidAmount / fullyPaidOn are
// always produced by calculatePaymentStatus(), so they can't drift apart.

import { toDayNumber } from "./days";

export type PaymentStatusValue = "NOT_PAID" | "PARTLY_PAID" | "FULLY_PAID";

/** A payment, as far as the status is concerned. */
export interface PaymentFacts {
    id: number;
    amount: number;
    paidOn: Date;
    /** Voided payments never count. */
    voidedAt: Date | null;
}

export interface CalculatedPaymentStatus {
    status: PaymentStatusValue;
    /** Sum of the payments that count. */
    paidAmount: number;
    /**
     * The paidOn date of the payment whose running total first reached the
     * rate (payments taken in paidOn order). Null unless fully paid.
     *
     * Example, rate ₹30,000: ₹10,000 on 02/11, ₹20,000 on 09/11 -> 09/11.
     */
    fullyPaidOn: Date | null;
}

/**
 * Paid status of one contract from what is due and its payments. `rate` is
 * the amount due: the contract rate, or -- after End order -- the charge for
 * the days served (see contractAmountDue). Nothing due (a ₹0 charge) counts
 * as fully paid: nothing is left to collect.
 */
export function calculatePaymentStatus(rate: number, payments: PaymentFacts[]): CalculatedPaymentStatus {
    const counting = payments
        .filter((p) => p.voidedAt === null)
        .sort((a, b) => toDayNumber(a.paidOn) - toDayNumber(b.paidOn) || a.id - b.id);

    let runningTotal = 0;
    let fullyPaidOn: Date | null = null;
    for (const payment of counting) {
        runningTotal += payment.amount;
        if (fullyPaidOn === null && runningTotal >= rate) fullyPaidOn = payment.paidOn;
    }

    const status: PaymentStatusValue =
        runningTotal >= rate ? "FULLY_PAID" : runningTotal === 0 ? "NOT_PAID" : "PARTLY_PAID";
    return { status, paidAmount: runningTotal, fullyPaidOn: status === "FULLY_PAID" ? fullyPaidOn : null };
}

/**
 * What the customer must pay for a contract: the charge once the order ended,
 * else the rate -- minus any part the Owner wrote off (which then counts as
 * settled: nothing is left to collect).
 */
export function contractAmountDue(contract: { rate: number; charge: number | null; writtenOffAmount: number }): number {
    return (contract.charge ?? contract.rate) - contract.writtenOffAmount;
}

/**
 * After End order: what we must give back on a contract -- paid more than
 * the charge, minus refunds already recorded. 0 while the order runs.
 */
export function refundDue(contract: { charge: number | null; paidAmount: number; refundedAmount: number }): number {
    if (contract.charge === null) return 0;
    return Math.max(0, contract.paidAmount - contract.charge - contract.refundedAmount);
}

/** What is still owed on a contract (never below 0). */
export function balanceDue(rate: number, paidAmount: number): number {
    return Math.max(0, rate - paidAmount);
}
