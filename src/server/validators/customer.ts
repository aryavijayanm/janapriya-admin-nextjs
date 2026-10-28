import { z } from "zod";

// Shared by the server (customer.actions, the list page) and the browser
// (customerForm, customerTable), so both enforce the same rules. No
// @prisma/client import: this file ends up in the browser bundle.

export const CUSTOMER_STATUSES = ["ACTIVE", "DISABLED", "DELETED"] as const;
// "code" sorts by id -- the customer code IS the id, formatted.
export const CUSTOMER_SORT_KEYS = ["name", "code"] as const;

// --- Customer code: "CR-000042" -----------------------------------------
// Not stored anywhere: it IS the customer's id, formatted for people (phone
// calls, receipts). Six digits keeps codes the same width; a 7-digit id would
// simply print as CR-1000000.

export function formatCustomerCode(id: number): string {
    return `CR-${String(id).padStart(6, "0")}`;
}

/**
 * Reads a typed customer code back into an id: "CR-000042", "cr-42" and
 * "CR42" all give 42. Anything else gives null, so the search falls back to
 * an ordinary text search.
 */
export function parseCustomerCode(text: string): number | null {
    const match = /^cr-?0*(\d+)$/i.exec(text.trim());
    if (!match) return null;
    const id = Number(match[1]);
    return Number.isSafeInteger(id) && id > 0 ? id : null;
}

// --- The add / edit form --------------------------------------------------

// Digits, with an optional "+" only at the very start. No fixed country
// prefix: a customer can be anywhere in the world.
const PHONE_PATTERN = /^\+?\d+$/;
const PHONE_RULE = "can contain only digits, with an optional + at the start";

const requiredText = (message: string) => z.string().trim().min(1, message);

// Empty box -> null, so clearing a field in Edit really clears it.
const optionalText = z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value));

// Field order matches the form, so the first error shown is the first wrong
// field on screen.
export const customerSchema = z.object({
    name: requiredText("Name is required"),
    contactNumber1: z
        .string()
        .trim()
        .min(1, "Contact number 1 is required")
        .regex(PHONE_PATTERN, `Contact number 1 ${PHONE_RULE}`),
    contactNumber2: z
        .string()
        .trim()
        .refine((value) => value === "" || PHONE_PATTERN.test(value), `Contact number 2 ${PHONE_RULE}`)
        .transform((value) => (value === "" ? null : value)),
    email: z
        .string()
        .trim()
        .refine((value) => value === "" || z.email().safeParse(value).success, "Email address is not valid")
        .transform((value) => (value === "" ? null : value)),
    idProof: optionalText,
    idNumber: optionalText,
    address: requiredText("Address is required"),
    remarks: optionalText,
});

// --- Everything else that arrives from the browser ------------------------

export const customerIdSchema = z.number().int().positive();
/** What's typed into a customer picker. */
export const customerSearchSchema = z.string().trim().min(1, "Type something to search").max(100);
export const customerStatusSchema = z.enum(CUSTOMER_STATUSES);
/** "Save anyway" after a possible-duplicate warning. */
export const confirmDuplicateSchema = z.boolean();

/**
 * The list page's URL: ?page=2&sortBy=name&sortDir=desc&search=kodakara
 * User-editable, so every field falls back (.catch) instead of throwing.
 */
export const customerListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).catch(1),
    sortBy: z.enum(CUSTOMER_SORT_KEYS).optional().catch(undefined),
    sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
    search: z.string().trim().max(100).optional().catch(undefined),
});

export type CustomerInput = z.infer<typeof customerSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type CustomerStatusValue = z.infer<typeof customerStatusSchema>;
