// What "End order" charges, as pure functions: no database, no Next.js.
//
// The rule (owner's decision):
//   charge = contract rate / 28 x days served, rounded down
//   (the customer keeps the extra rupee -- the safe side for a refund)
//
// e.g. rate ₹22,000, 10 days served -> floor(22,000 x 10 / 28) = ₹7,857
//      paid ₹22,000 -> refund ₹14,143
// A full contract (28 days) -> charge = rate -> nothing to refund.

import { SERVICE_DAYS_PER_CONTRACT } from "./contract-dates";

/** The charge for the days served. */
export function chargeForServedDays(rate: number, servedDays: number): number {
    return Math.floor((rate * Math.min(servedDays, SERVICE_DAYS_PER_CONTRACT)) / SERVICE_DAYS_PER_CONTRACT);
}

/** What happens to one contract when the order ends. */
export type EndedContractOutcome =
    /** Not started and nothing ever paid on it: removed. */
    | { kind: "remove" }
    /** Kept, charged for its served days (0 if none -- then all it was paid is refunded). */
    | { kind: "charge"; charge: number };

/**
 * A contract with no served days and no payment rows at all is removed.
 * (A voided payment still counts as a row: payment history is never lost,
 * so that contract stays, with a ₹0 charge.)
 */
export function endedContractOutcome(contract: { rate: number; servedDays: number; paymentRows: number }): EndedContractOutcome {
    if (contract.servedDays === 0 && contract.paymentRows === 0) return { kind: "remove" };
    return { kind: "charge", charge: chargeForServedDays(contract.rate, contract.servedDays) };
}
