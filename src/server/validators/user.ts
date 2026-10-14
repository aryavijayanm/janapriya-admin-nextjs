import { z } from "zod";

// Replaces the old create-user.dto.ts / update-user.dto.ts. Imported by BOTH
// the server (user.actions -> the real check) and the browser (UserFormModal
// -> instant feedback), so the rules exist exactly once.
//
// Deliberately no @prisma/client import, even for the Role enum: this file
// ends up in the browser bundle, and Prisma must never be shipped there.
// If a role is ever removed from schema.prisma, TypeScript flags the mismatch
// where the service passes `role` to Prisma.
export const ROLES = ["OWNER", "STAFF", "OUTSIDER"] as const;

const nameField = z.string().trim().min(1, "Name is required");
const designationField = z.string().trim().min(1, "Designation is required");
const passwordField = z
    .string()
    .min(6, "Password must be at least 6 characters")
    // bcrypt only reads the first 72 bytes; the cap stops someone posting a
    // megabyte "password" just to make the server hash it.
    .max(200, "Password is too long");

export const createUserSchema = z.object({
    name: nameField,
    // Normalised here, so "  Arya " and "arya" can never become two accounts.
    username: z.string().trim().toLowerCase().min(1, "Username is required"),
    designation: designationField,
    role: z.enum(ROLES, { error: "Please select a role" }),
    password: passwordField,
});

// Deliberately no `username` or `role`: both are fixed at creation and never
// change afterward, even by an Owner (carried over from the old UpdateUserDto).
// Leaving them out of the schema means they can't be changed by calling the
// action directly, not just hidden in the form.
export const updateUserSchema = z.object({
    name: nameField,
    designation: designationField,
    // Absent = keep the current password.
    password: passwordField.optional(),
});

// Ids and flags arrive from the browser as plain arguments -- validated like
// everything else, since an action can be called with anything.
export const userIdSchema = z.number().int().positive();
export const isActiveSchema = z.boolean();

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
