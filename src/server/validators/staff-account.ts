import { z } from "zod";
import { dateField, rupees } from "./order";

// Shared by the server (staff.actions, staff-account.service) and the browser
// (the staff account dialogs), so both enforce the same rules. No
// @prisma/client import: this file ends up in the browser bundle.
//
// Dates arrive as yyyy-mm-dd: the form's DD/MM/YYYY text box is converted
// with parseDayMonthYear() (lib/date.ts) before sending.

export const STAFF_PAYMENT_MODES = ["CASH_OFFICE", "CASH_OWNER", "CASH_CUSTOMER", "ONLINE_TRANSFER", "OTHER"] as const;
export type StaffPaymentModeValue = (typeof STAFF_PAYMENT_MODES)[number];

/** What each mode is called on screen -- one place, used by every staff-money screen. */
export const STAFF_PAYMENT_MODE_LABELS: Record<StaffPaymentModeValue, string> = {
    CASH_OFFICE: "Cash from Office",
    CASH_OWNER: "Cash from Owner",
    CASH_CUSTOMER: "Cash from customer",
    ONLINE_TRANSFER: "Online transfer",
    OTHER: "Other",
};

/**
 * How money can come BACK from the staff (RECEIVED entries). Same stored
 * values as above, worded for the other direction; "from customer" doesn't
 * apply here.
 */
export const STAFF_RECEIVED_MODES = ["CASH_OFFICE", "CASH_OWNER", "ONLINE_TRANSFER", "OTHER"] as const;
export type StaffReceivedModeValue = (typeof STAFF_RECEIVED_MODES)[number];

export const STAFF_RECEIVED_MODE_LABELS: Record<StaffReceivedModeValue, string> = {
    CASH_OFFICE: "Cash to Office",
    CASH_OWNER: "Cash to Owner",
    ONLINE_TRANSFER: "Online transfer",
    OTHER: "Other",
};

/**
 * The kind of passbook entry:
 *   PAID      -- money given to the staff (stored as a minus amount; shown in "Paid")
 *   EXTRA     -- a one-time amount added for them (plus; shown as "Earning" in "Earned")
 *   RECEIVED  -- money the staff paid back (plus; closes what they owe)
 *   WRITE_OFF -- what they owe, forgiven by the Owner (plus; no money moves)
 * RECEIVED and WRITE_OFF only while the staff owes, and at most what they owe.
 * The sign is for adding up; the type is for meaning, rules and display.
 * (Duty corrections need no entry type: they show up as To settle by themselves.)
 */
export type StaffEntryTypeValue = "PAID" | "EXTRA" | "RECEIVED" | "WRITE_OFF";

/** What each entry type is called on screen. */
export const STAFF_ENTRY_TYPE_LABELS: Record<StaffEntryTypeValue, string> = {
    PAID: "Paid to staff",
    EXTRA: "Earning",
    RECEIVED: "Received from staff",
    WRITE_OFF: "Write off",
};

/** Only the Owner may forgive money (add or void a WRITE_OFF). */
export const WRITE_OFF_ROLES = ["OWNER"] as const;

const remarks = z
    .string()
    .trim()
    .min(1, "Please add remarks (what it was for)")
    .max(200, "Remarks can be at most 200 characters");

const accountDetails = z
    .string()
    .trim()
    .max(200, "Account details can be at most 200 characters")
    .transform((value) => (value === "" ? null : value));

const mode = z.enum(STAFF_PAYMENT_MODES, { error: "Please choose how it was paid" });

/**
 * "+ Add entry": money PAID to the staff, a one-time EXTRA for them, or --
 * while they owe -- money RECEIVED back or a WRITE_OFF. The amount is always
 * typed as a positive number; the server stores the sign. No manual
 * deductions (owner's decision).
 */
export const staffEntrySchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("PAID"),
        amount: rupees("Amount"),
        entryDate: dateField("Date of pay"),
        remarks,
        mode,
        accountDetails,
    }),
    z.object({
        type: z.literal("EXTRA"),
        amount: rupees("Amount"),
        entryDate: dateField("Date"),
        remarks,
    }),
    z.object({
        type: z.literal("RECEIVED"),
        amount: rupees("Amount"),
        entryDate: dateField("Date received"),
        remarks,
        mode: z.enum(STAFF_RECEIVED_MODES, { error: "Please choose how it was received" }),
        accountDetails,
    }),
    z.object({
        type: z.literal("WRITE_OFF"),
        amount: rupees("Amount"),
        entryDate: dateField("Date"),
        remarks,
    }),
]);

/**
 * "Clear the salary now".
 *   expectedFinalAmount -- the final amount the person saw; the server refuses
 *                          if it recalculates a different one (no surprises)
 *   payment             -- how and when it's paid; needed only when the final
 *                          amount is above 0 (null when nothing is paid)
 */
export const clearSalarySchema = z.object({
    expectedFinalAmount: z.number().int(),
    payment: z
        .object({
            paidOn: dateField("Date of pay"),
            mode,
            remarks,
            accountDetails,
        })
        .nullable(),
});

export const voidStaffEntrySchema = z.object({
    reason: z.string().trim().min(1, "Please give a reason for voiding this entry").max(200, "The reason is too long"),
});

export const staffEntryIdSchema = z.number().int().positive();

export type StaffEntryInput = z.infer<typeof staffEntrySchema>;
export type ClearSalaryInput = z.infer<typeof clearSalarySchema>;
