// Which contracts of one order the payments table shows -- a pure function
// (no database), so the rule lives in one place and is easy to test.
//
//   Rama   K7QT  #3 Partly paid          <- something still to collect: only those rows
//   Suresh M2PL  #2 Not paid, #3 Not paid
//   Lakshmi Q9RT #4 Fully paid           <- everything paid: the latest contract only
//   Anu    B7XD  #5 Refund to give       <- Owner only, ended orders
//
// The database query has already picked WHICH orders are on the page; this
// only picks the rows inside each one.

import { refundDue } from "./payments";
import type { PaymentStatusValue } from "./payments";

/** Same values as validators/payments-list.ts (domain code imports no validators). */
export type PaymentsFilterValue = "all" | "NOT_PAID" | "PARTLY_PAID" | "FULLY_PAID" | "REFUND";

export interface ContractMoneyFacts {
    contractNumber: number;
    paymentStatus: PaymentStatusValue;
    charge: number | null;
    paidAmount: number;
    refundedAmount: number;
}

/**
 * The rows to show for one order, oldest first.
 * `showRefunds`: the Owner sees contracts with a refund to give; others don't.
 */
export function contractsToShow<T extends ContractMoneyFacts>(
    contracts: T[],
    filter: PaymentsFilterValue,
    showRefunds: boolean,
): T[] {
    const sorted = [...contracts].sort((a, b) => a.contractNumber - b.contractNumber);
    const latest = sorted.slice(-1);
    const hasRefund = (c: T) => showRefunds && refundDue(c) > 0;

    switch (filter) {
        case "NOT_PAID":
        case "PARTLY_PAID":
            return sorted.filter((c) => c.paymentStatus === filter);
        case "FULLY_PAID":
            return latest;
        case "REFUND":
            return sorted.filter(hasRefund);
        case "all": {
            const open = sorted.filter((c) => c.paymentStatus !== "FULLY_PAID" || hasRefund(c));
            return open.length > 0 ? open : latest;
        }
    }
}
