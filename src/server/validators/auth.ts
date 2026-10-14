import { z } from "zod";

// The login contract. One schema gives both the runtime check AND the
// TypeScript type (LoginInput below), so the two can never disagree -- the
// old class-validator DTO needed a class and decorators to get the same.
//
// No server-only guard: validators are the one part of server/ that client
// code may import, since the same schema can validate a form in the browser.
export const loginSchema = z.object({
    username: z.string().trim().min(1, "Username is required"),
    password: z
        .string()
        .min(1, "Password is required")
        // bcrypt only ever reads the first 72 bytes, so nothing longer can
        // matter. The cap stops someone posting a megabyte "password" to make
        // the server hash it.
        .max(200, "Password is too long"),
});

export type LoginInput = z.infer<typeof loginSchema>;
