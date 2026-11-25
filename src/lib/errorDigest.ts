/**
 * The short reference Next.js attaches to a server error ("digest"), which
 * also appears in the server log next to the full error -- so a user can read
 * it out and the developer can find the real cause.
 *
 * In Next.js 16 the error boundary receives the error as `unknown` (a Client
 * Component can throw anything), so it's checked before reading.
 */
export function errorDigest(error: unknown): string | null {
    if (error instanceof Error && "digest" in error && typeof error.digest === "string") return error.digest;
    return null;
}
