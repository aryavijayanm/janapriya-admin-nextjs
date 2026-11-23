// The WhatsApp payment reminder: which contracts need one, and its exact text.
// Pure functions (no database, no React), so the payments table (browser) and
// payment.service (server) use the SAME rule -- the button never shows on a
// row the server would refuse -- and if reminders are ever sent automatically,
// the server reuses this exact wording.

import { formatRupees } from "@/lib/money";
import { formatDayMonthYear } from "./days";
import type { PaymentStatusValue } from "./payments";

/** A started contract that isn't fully paid (Not paid or Partly paid). */
export function needsPaymentReminder(contract: {
    paymentStatus: PaymentStatusValue;
    startDate: Date | null;
}): boolean {
    return contract.paymentStatus !== "FULLY_PAID" && contract.startDate !== null;
}

/**
 *   Gentle Reminder.
 *   Contract 2
 *   from 01/11/2026 to 28/11/2026
 *   Amount/Balance to be paid : ₹14,000
 *
 * `balance` = what is still to pay, so a partly paid contract shows the rest,
 * not the full rate. No end date yet (rare): just "from <start>".
 */
export function paymentReminderMessage(contract: {
    contractNumber: number;
    startDate: Date;
    endDate: Date | null;
    balance: number;
}): string {
    const period = contract.endDate
        ? `from ${formatDayMonthYear(contract.startDate)} to ${formatDayMonthYear(contract.endDate)}`
        : `from ${formatDayMonthYear(contract.startDate)}`;
    return [
        "Gentle Reminder.",
        `Contract ${contract.contractNumber}`,
        period,
        `Amount/Balance to be paid : ${formatRupees(contract.balance)}`,
    ].join("\n");
}
