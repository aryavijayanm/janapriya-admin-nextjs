// Browsers have no equivalent to Node's process.env.TZ -- a page can't force
// a visitor's own OS timezone. This file is the frontend's answer to that:
// every date shown anywhere in the app should go through one of these
// functions instead of raw Date methods, so "Asia/Kolkata" is written in
// exactly one place, not repeated at every call site.

const KERALA_TIME_ZONE = "Asia/Kolkata";

export function formatDateTime(value: string | Date): string {
    const date = typeof value === "string" ? new Date(value) : value;
    return date.toLocaleString("en-IN", {
        timeZone: KERALA_TIME_ZONE,
        dateStyle: "medium",
        timeStyle: "short",
    });
}

export function formatDate(value: string | Date): string {
    const date = typeof value === "string" ? new Date(value) : value;
    return date.toLocaleDateString("en-IN", {
        timeZone: KERALA_TIME_ZONE,
        dateStyle: "medium",
    });
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
