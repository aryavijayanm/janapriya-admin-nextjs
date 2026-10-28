import { z } from "zod";

// Shared by the server (order.actions, the order pages) and the browser (the
// order forms and dialogs), so both enforce the same rules. No @prisma/client
// import: this file ends up in the browser bundle.

export const BRANCHES = ["KERALA", "OUTSIDE"] as const;
export const DAY_PARTS = ["FULL", "HALF", "NO_PAY"] as const;
/** Worked out from the data, never stored (see order.service). */
export const ORDER_STATUSES = ["WAITING", "ACTIVE", "ENDED"] as const;

// --- Order code: 4 characters, e.g. "K7QT" ---------------------------------
// Consonants plus the digits 1-9: 30 characters, 810,000 possible codes.
// No vowels (so a code can never spell a word), and no 0 -- which also means
// the look-alike pairs O/0 and I/1 can never both appear, so codes read
// clearly over the phone. Generated with crypto randomness in order.service.
export const ORDER_CODE_CHARACTERS = "BCDFGHJKLMNPQRSTVWXYZ123456789";
export const ORDER_CODE_LENGTH = 4;
export const orderCodeSchema = z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[BCDFGHJKLMNPQRSTVWXYZ1-9]{4}$/, "Not a valid order code");

// --- Building blocks --------------------------------------------------------

const id = z.number().int().positive();

// <input type="date"> always sends yyyy-mm-dd, whatever the screen shows.
const dateField = (label: string) => z.iso.date({ error: `${label} is not a valid date` });

// Required, with no default on screen: a pre-selected "Full day" would be
// saved whenever someone forgot to change it. "" (nothing chosen) fails here.
const dayPart = (which: string) =>
    z.enum(DAY_PARTS, { error: `Please choose Full day, Half day or No pay for the ${which}` });

// Whole rupees, more than zero.
const rupees = (label: string) =>
    z.number({ error: `${label} is required` }).int(`${label} must be whole rupees`).positive(`${label} must be more than ₹0`);

const optionalText = z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value));

// --- Order (create / edit) ----------------------------------------------------

export const orderSchema = z.object({
    customerId: id,
    branch: z.enum(BRANCHES, { error: "Please choose a branch" }),
    serviceIds: z
        .array(id)
        .min(1, "Choose at least one service")
        .transform((ids) => [...new Set(ids)]),
    remarks: optionalText,
});

// --- Start care: creates contract #1 and the first duty period ---------------

export const startCareSchema = z.object({
    startDate: dateField("Start date"),
    startDayPart: dayPart("first day"),
    staffId: z.number({ error: "Please choose a staff member" }).int().positive(),
    rate: rupees("Customer rate"),
    staffSalary: rupees("Staff salary"),
});

// --- Update duty: the one button, two shapes ---------------------------------
// "stop":  someone is on duty -> they stop (and optionally the next staff starts)
// "start": nobody is on duty  -> someone starts (a return, or new staff)

const nextStaffSchema = z.object({
    staffId: z.number({ error: "Please choose the next staff member" }).int().positive(),
    startDate: dateField("Next staff start date"),
    startDayPart: dayPart("next staff's first day"),
});

export const updateDutySchema = z.discriminatedUnion("mode", [
    z.object({
        mode: z.literal("stop"),
        stopDate: dateField("Stop date"),
        stopDayPart: dayPart("last day"),
        endNote: optionalText,
        next: nextStaffSchema.nullable(),
    }),
    z.object({
        mode: z.literal("start"),
        staffId: z.number({ error: "Please choose a staff member" }).int().positive(),
        startDate: dateField("Start date"),
        startDayPart: dayPart("first day"),
    }),
]);

// --- Correcting one duty period directly -------------------------------------

export const editDutySchema = z
    .object({
        staffId: id,
        startDate: dateField("Start date"),
        startDayPart: dayPart("first day"),
        endDate: dateField("End date").nullable(),
        endDayPart: dayPart("last day").nullable(),
        endNote: optionalText,
    })
    .refine((d) => d.endDate === null || d.endDate >= d.startDate, {
        message: "End date can't be before the start date",
        path: ["endDate"],
    });

// --- Contract money (next contract, or editing an existing one) --------------

export const contractMoneySchema = z.object({
    rate: rupees("Customer rate"),
    staffSalary: rupees("Staff salary"),
});

// --- The order list's URL -----------------------------------------------------
// ?page=2&status=ACTIVE&branch=KERALA&search=rama
// User-editable, so every field falls back (.catch) instead of throwing.

export const orderListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).catch(1),
    status: z.enum(ORDER_STATUSES).optional().catch(undefined),
    branch: z.enum(BRANCHES).optional().catch(undefined),
    search: z.string().trim().max(100).optional().catch(undefined),
});

// --- The staff picker's search (sent while typing) ----------------------------

export const staffPickerQuerySchema = z.object({
    orderId: id,
    search: z.string().trim().max(100).optional(),
    // false = only staff who can do the order's services; true = all active staff
    includeAll: z.boolean(),
    // The date the staff member would start -- "busy elsewhere" is judged on this day.
    onDate: dateField("Date"),
});

export const orderIdSchema = id;
export const dutyIdSchema = id;
export const contractIdSchema = id;

export type OrderInput = z.infer<typeof orderSchema>;
export type StartCareInput = z.infer<typeof startCareSchema>;
export type UpdateDutyInput = z.infer<typeof updateDutySchema>;
export type EditDutyInput = z.infer<typeof editDutySchema>;
export type ContractMoneyInput = z.infer<typeof contractMoneySchema>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type StaffPickerQuery = z.infer<typeof staffPickerQuerySchema>;
export type OrderStatusValue = (typeof ORDER_STATUSES)[number];
