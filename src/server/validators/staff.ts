import { z } from "zod";

// Replaces the old create-staff.dto.ts / update-staff.dto.ts / find-staff.dto.ts.
// Shared by the server (staff.actions, the list page) and the browser
// (staffForm), so both sides enforce the same rules. No @prisma/client import:
// this file ends up in the browser bundle.

export const STAFF_STATUSES = ["ACTIVE", "DISABLED", "DELETED"] as const;
export const STAFF_SORT_KEYS = ["name", "age", "rating"] as const;

// Photo limits, shared with the browser so it can refuse a bad file before a
// slow upload. Keep STAFF_PHOTO_MAX_BYTES at or below next.config.ts's
// serverActions.bodySizeLimit, or big uploads fail before reaching our code.
export const STAFF_PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const STAFF_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

const requiredText = (message: string) => z.string().trim().min(1, message);

// Empty box -> null. Sending null (rather than leaving the field out, as the
// old form did with `|| undefined`) means clearing a field in Edit actually
// clears it. In the old project, once a guardian name was saved it could
// never be emptied again.
const optionalText = z
    .string()
    .trim()
    .transform((value) => (value === "" ? null : value));

/** The create/edit form. The edit form always sends every field, so one schema serves both. */
export const staffSchema = z.object({
    name: requiredText("Name is required"),
    place: requiredText("Place is required"),
    // Digits only, any length (owner's decision -- the old form capped it at
    // 10). The fixed +91 prefix is added here, once, instead of by the browser.
    contactNumber: z
        .string()
        .trim()
        .min(1, "Contact number is required")
        .regex(/^\d+$/, "Contact number must contain digits only")
        .transform((digits) => `+91${digits}`),
    // "" (left empty) or a yyyy-mm-dd date from <input type="date">.
    dob: z
        .union([z.literal(""), z.iso.date({ error: "Date of birth is not a valid date" })])
        .transform((value) => (value === "" ? null : value)),
    guardianName: optionalText,
    relationshipWithGuardian: optionalText,
    // Optional, but if given: digits only, any length. No +91 prefix (unchanged
    // from the old form). The old form accepted any text here.
    guardianContactNumber: z
        .string()
        .trim()
        .regex(/^\d*$/, "Guardian contact number must contain digits only")
        .transform((value) => (value === "" ? null : value)),
    // Required, matching what the old form enforced (the old server didn't).
    verifiedAddress: requiredText("Verified address is required"),
    idProof: optionalText,
    idNumber: optionalText,
    bankAccountDetails: optionalText,
    rating: z.number().int().min(0).max(10),
    remarks: optionalText,
    // De-duplicated, so a repeated id can't create two links.
    serviceIds: z
        .array(z.number().int().positive())
        .transform((ids) => [...new Set(ids)]),
});

export const staffIdSchema = z.number().int().positive();
export const staffStatusSchema = z.enum(STAFF_STATUSES);

/**
 * The list page's URL: ?page=2&sortBy=age&sortDir=desc&serviceIds=1,3&search=kochi
 *
 * The URL is user-editable, so every field falls back to "not set" (.catch)
 * instead of throwing -- a mangled link still shows the list, it just ignores
 * the bad part.
 */
export const staffListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).catch(1),
    sortBy: z.enum(STAFF_SORT_KEYS).optional().catch(undefined),
    sortDir: z.enum(["asc", "desc"]).optional().catch(undefined),
    // One comma-joined parameter ("1,3,5"), not repeated keys -- the same
    // encoding the old FindStaffDto agreed on with the frontend.
    serviceIds: z
        .string()
        .transform((value) => value.split(",").filter(Boolean).map(Number))
        .pipe(z.array(z.number().int().positive()))
        .optional()
        .catch(undefined),
    search: z.string().trim().max(100).optional().catch(undefined),
});

export type StaffInput = z.infer<typeof staffSchema>;
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;
export type StaffStatusValue = z.infer<typeof staffStatusSchema>;
