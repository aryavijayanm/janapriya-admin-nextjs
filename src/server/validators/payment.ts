import { z } from "zod";
import { dateField, optionalText, rupees } from "./order";

// Shared by the server (order.actions, payment.service) and the browser (the
// payment dialogs), so both enforce the same rules. No @prisma/client import:
// this file ends up in the browser bundle.

export const PAYMENT_MODES = ["CASH_OFFICE", "CASH_OWNER", "TO_ACCOUNT", "PAID_TO_STAFF", "OTHER"] as const;
export type PaymentModeValue = (typeof PAYMENT_MODES)[number];

/** What each mode is called on screen -- one place, used by every payment screen. */
export const PAYMENT_MODE_LABELS: Record<PaymentModeValue, string> = {
    CASH_OFFICE: "Cash - Office",
    CASH_OWNER: "Cash - Owner",
    TO_ACCOUNT: "To account",
    PAID_TO_STAFF: "Paid to staff",
    OTHER: "Other",
};

export const paymentSchema = z.object({
    amount: rupees("Amount"),
    // Typed by the user (often recorded days later) -- never defaulted.
    paidOn: dateField("Paid on date"),
    mode: z.enum(PAYMENT_MODES, { error: "Please choose how it was paid" }),
    // e.g. "Rama SBI" -- optional
    accountDetails: optionalText.pipe(z.string().max(200, "Account details are too long").nullable()),
});

export const voidPaymentSchema = z.object({
    reason: z
        .string()
        .trim()
        .min(1, "Please give a reason for voiding this payment")
        .max(200, "The reason is too long"),
});

export const paymentIdSchema = z.number().int().positive();

// --- Refunds (after End order) ---------------------------------------------------

/** How money goes BACK to a customer ("Paid to staff" doesn't apply). */
export const REFUND_MODES = ["CASH_OFFICE", "CASH_OWNER", "TO_ACCOUNT", "OTHER"] as const;
export type RefundModeValue = (typeof REFUND_MODES)[number];

export const refundSchema = z.object({
    amount: rupees("Refund amount"),
    // Typed by the user -- never defaulted, never in the future.
    refundedOn: dateField("Refund date"),
    mode: z.enum(REFUND_MODES, { error: "Please choose how it was refunded" }),
    accountDetails: optionalText.pipe(z.string().max(200, "Account details are too long").nullable()),
    remarks: z.string().trim().min(1, "Please add remarks").max(200, "Remarks can be at most 200 characters"),
});

// --- Write off (Owner only, after End order) ----------------------------------

export const writeOffSchema = z.object({
    // Typed as DD/MM/YYYY on screen, sent as yyyy-mm-dd (parseDayMonthYear).
    writtenOffOn: dateField("Write-off date"),
    reason: z.string().trim().min(1, "Please give the reason for the write-off").max(200, "The reason can be at most 200 characters"),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
export type VoidPaymentInput = z.infer<typeof voidPaymentSchema>;
export type RefundInput = z.infer<typeof refundSchema>;
export type WriteOffInput = z.infer<typeof writeOffSchema>;
