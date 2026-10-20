// Browsers have no equivalent to Node's process.env.TZ -- a page can't force
// a visitor's own OS timezone. This file is the frontend's answer to that:
// every date shown anywhere in the app should go through one of these
// functions instead of raw Date methods, so "Asia/Kolkata" is written in
// exactly one place, not repeated at every call site.

const KERALA_TIME_ZONE = "Asia/Kolkata";

// Day, month and year of `date` in Kerala time, zero-padded ("05", "11",
// "2026"). Assembled from parts rather than trusting a locale's own ordering,
// so the result is always DD/MM/YYYY whatever language the browser or server
// is set to.
function keralaDateParts(date: Date): { day: string; month: string; year: string } {
    const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: KERALA_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
    return { day: part("day"), month: part("month"), year: part("year") };
}

/**
 * The app-wide on-screen date format: DD/MM/YYYY, e.g. "15/11/2026".
 * (The database stores real DATE values, which have no format; this is
 * only how they're shown.)
 */
export function formatDate(value: string | Date): string {
    const date = typeof value === "string" ? new Date(value) : value;
    const { day, month, year } = keralaDateParts(date);
    return `${day}/${month}/${year}`;
}

/** Date and time in Kerala time, e.g. "15/11/2026, 3:05 pm". */
export function formatDateTime(value: string | Date): string {
    const date = typeof value === "string" ? new Date(value) : value;
    const time = date.toLocaleTimeString("en-IN", {
        timeZone: KERALA_TIME_ZONE,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
    return `${formatDate(date)}, ${time}`;
}

// yyyy-mm-dd, the only format <input type="date"> accepts as its value --
// "en-CA" is just the locale that happens to format dates that way.
export function toDateInputValue(value: string | Date): string {
    const date = typeof value === "string" ? new Date(value) : value;
    return date.toLocaleDateString("en-CA", { timeZone: KERALA_TIME_ZONE });
}

// Whole years between a birth date and "today" in Kerala -- "today" is
// resolved through the same timezone as everything else here, not the
// browser's local date, so this can't be off by one near midnight for a
// visitor in a different timezone.
export function calculateAge(dob: string | Date): number {
    const birthDate = typeof dob === "string" ? new Date(dob) : dob;
    const today = new Date(toDateInputValue(new Date()));

    let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
    const hadBirthdayThisYear =
        today.getUTCMonth() > birthDate.getUTCMonth() ||
        (today.getUTCMonth() === birthDate.getUTCMonth() &&
            today.getUTCDate() >= birthDate.getUTCDate());
    if (!hadBirthdayThisYear) age--;

    return age;
}
