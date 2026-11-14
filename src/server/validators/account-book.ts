import { z } from "zod";
import { dateField, rupees } from "./order";
import { PAYMENT_MODE_LABELS, type PaymentModeValue } from "./payment";
import { STAFF_PAYMENT_MODE_LABELS, STAFF_RECEIVED_MODE_LABELS, type StaffPaymentModeValue } from "./staff-account";

// The accounts book. Shared by the server (actions, service, export) and the
// browser (the entry popup, the table), so both enforce the same rules. No
// @prisma/client import: this file ends up in the browser bundle.
//
// Dates arrive as yyyy-mm-dd: the popup's DD/MM/YYYY text box is converted
// with parseDayMonthYear() (lib/date.ts) before sending.

export const ACCOUNT_DIRECTIONS = ["IN", "OUT"] as const;
export type AccountDirectionValue = (typeof ACCOUNT_DIRECTIONS)[number];

/**
 * IN / OUT is only the stored value. On screen and in Excel money in is a
 * Receipt and money out is a Payment (cash book wording, owner's decision).
 * Receipts always come first (left), Payments second (right).
 */
export const ACCOUNT_DIRECTION_LABELS: Record<AccountDirectionValue, string> = {
    IN: "Receipt",
    OUT: "Payment",
};

export const ACCOUNT_ENTRY_MODES = ["CASH_OFFICE", "CASH_OWNER", "ONLINE", "OTHER"] as const;
export type AccountEntryModeValue = (typeof ACCOUNT_ENTRY_MODES)[number];

export const ACCOUNT_ENTRY_MODE_LABELS: Record<AccountEntryModeValue, string> = {
    CASH_OFFICE: "Cash - Office",
    CASH_OWNER: "Cash - Owner",
    ONLINE: "Online",
    OTHER: "Other",
};

/**
 * Where a row of the book comes from:
 *   ENTRY    -- typed into the book (the only kind that can be edited / deleted)
 *   PAYMENT  -- a customer payment (Payment table)
 *   REFUND   -- money given back to a customer (Refund table)
 *   STAFF_PAID     -- salary / advance paid to a staff member (StaffAccountEntry PAID)
 *   STAFF_RECEIVED -- money a staff member paid back (StaffAccountEntry RECEIVED)
 */
export const ACCOUNT_SOURCES = ["ENTRY", "PAYMENT", "REFUND", "STAFF_PAID", "STAFF_RECEIVED"] as const;
export type AccountSource = (typeof ACCOUNT_SOURCES)[number];

export const ACCOUNT_SOURCE_LABELS: Record<AccountSource, string> = {
    ENTRY: "Entry",
    PAYMENT: "Customer payment",
    REFUND: "Refund to customer",
    STAFF_PAID: "Staff salary",
    STAFF_RECEIVED: "Received from staff",
};

/**
 * "How" for any row. The stored value comes from a different list depending
 * on where the row comes from, so the label is looked up in that list.
 * One function, used by the table and the Excel file.
 */
export function accountModeLabel(source: AccountSource, mode: string): string {
    switch (source) {
        case "ENTRY":
            return ACCOUNT_ENTRY_MODE_LABELS[mode as AccountEntryModeValue] ?? mode;
        case "PAYMENT":
        case "REFUND":
            return PAYMENT_MODE_LABELS[mode as PaymentModeValue] ?? mode;
        case "STAFF_PAID":
            return STAFF_PAYMENT_MODE_LABELS[mode as StaffPaymentModeValue] ?? mode;
        case "STAFF_RECEIVED":
            return STAFF_RECEIVED_MODE_LABELS[mode as keyof typeof STAFF_RECEIVED_MODE_LABELS] ?? mode;
    }
}

/** Add entry and Edit entry -- the same popup, the same rules. */
export const accountEntrySchema = z.object({
    entryDate: dateField("Date"),
    direction: z.enum(ACCOUNT_DIRECTIONS, { error: "Please choose Receipt or Payment" }),
    amount: rupees("Amount"),
    mode: z.enum(ACCOUNT_ENTRY_MODES, { error: "Please choose how the money moved" }),
    reason: z.string().trim().min(1, "Please give a reason").max(200, "The reason can be at most 200 characters"),
});

export const accountEntryIdSchema = z.number().int().positive();

/**
 * The book's URL (?day=2026-11-13&page=2):
 *   day  -- the day shown in the day card (missing or nonsense = today)
 *   page -- the page of this month's table (nonsense = page 1)
 */
export const accountBookQuerySchema = z.object({
    day: z.iso.date().optional().catch(undefined),
    page: z.coerce.number().int().min(1).catch(1),
});

/** From and to, yyyy-mm-dd, both days included. */
export interface AccountDateRange {
    from: string;
    to: string;
}

/** The Owner's Excel download: a from-to date range (both days included). */
export const accountExportSchema = z
    .object({
        from: dateField("From date"),
        to: dateField("To date"),
    })
    .refine((range) => range.from <= range.to, { error: "The From date must be on or before the To date" });

export type AccountEntryInput = z.infer<typeof accountEntrySchema>;
export type AccountBookQuery = z.infer<typeof accountBookQuerySchema>;
export type AccountExportRange = z.infer<typeof accountExportSchema>;
