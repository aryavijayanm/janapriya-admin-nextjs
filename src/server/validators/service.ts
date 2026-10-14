import { z } from "zod";

// Replaces the old create-service.dto.ts / update-service.dto.ts. Used by both
// the server (service.actions) and the browser (ServiceFormModal). The
// messages are the old form's exact wording.
//
// One schema for create AND edit: the edit form always sends both fields, so
// there is no partial-update shape to describe. Enable/Disable is a separate
// action with its own input, not a field here.
export const serviceSchema = z.object({
    name: z.string().trim().min(1, "Service name is required."),
    // Always stored in UPPERCASE, so "bc" becomes "BC" and is caught as a
    // duplicate by a plain comparison -- and by the database's unique index.
    abbreviation: z.string().trim().toUpperCase().min(1, "Abbreviation is required."),
});

export const serviceIdSchema = z.number().int().positive();
export const serviceIsActiveSchema = z.boolean();

export type ServiceInput = z.infer<typeof serviceSchema>;
