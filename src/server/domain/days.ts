// Whole-day arithmetic for calendar dates (Postgres DATE columns).
//
// A DATE arrives from the database as midnight UTC. Turning it into a day
// number (days since 1970-01-01) makes "the next day", "how many days" and
// "is this before that" plain integer maths -- no clock times, no timezones.
// Shared by every domain rule that works with calendar days.

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDayNumber(date: Date): number {
    return Math.round(date.getTime() / DAY_MS);
}

export function fromDayNumber(day: number): Date {
    return new Date(day * DAY_MS);
}

/** "2026-11-15" (what <input type="date"> sends) -> a DATE value (midnight UTC). */
export function fromIsoDate(iso: string): Date {
    return new Date(`${iso}T00:00:00.000Z`);
}

/**
 * A DATE value as DD/MM/YYYY, for messages written by the server. Screens use
 * formatDate() in src/lib/date.ts; server code can't depend on that file.
 */
export function formatDayMonthYear(date: Date): string {
    const day = String(date.getUTCDate()).padStart(2, "0");
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${date.getUTCFullYear()}`;
}
