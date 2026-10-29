// The "possible duplicate" rules, shared by the customer and staff checks so
// both warn in exactly the same way. Pure: no database, no Next.js.
//
// A match is only a WARNING: the user sees who matched and why, then chooses
// "Continue anyway" or "Cancel". Nothing is ever blocked.

/**
 * How similar (0 to 1) an address must be to an existing one to warn. Chosen
 * as 0.6 after testing pg_trgm on real-style Kerala addresses: it catches the
 * same house typed differently (pincode added, "House" vs "Veedu") at the cost
 * of a few false alarms -- acceptable for a warning.
 */
export const ADDRESS_SIMILARITY_THRESHOLD = 0.6;

/** The warning lists at most this many look-alikes. */
export const MAX_DUPLICATES_SHOWN = 5;

/**
 * "+91 98765-43210" -> "9876543210". Phones are compared on their last 10
 * digits, so a country code or spaces don't hide a match. The SQL checks use
 * the same rule: right(regexp_replace(phone, '[^0-9]', '', 'g'), 10).
 */
export function lastTenDigits(phone: string): string {
    return phone.replace(/\D/g, "").slice(-10);
}

/**
 * "1234 5678-9012" / "abc123" -> "123456789012" / "abc123". ID numbers are
 * compared ignoring spaces, dashes and capital/small letters. null when
 * nothing is left to compare. SQL: lower(regexp_replace(id, '[^a-zA-Z0-9]', '', 'g')).
 */
export function normalizeIdNumber(idNumber: string | null): string | null {
    const normalized = (idNumber ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    return normalized === "" ? null : normalized;
}

/** Address similarity (0-1) as the whole percentage shown on screen. */
export function similarityPercent(score: number): number {
    return Math.trunc(score * 100);
}
