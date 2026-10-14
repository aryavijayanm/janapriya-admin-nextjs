// Representative domain module: a pure business rule with zero imports.
//
// It takes data in and returns a value. No database, no Next.js, no React,
// no clock reading hidden inside it -- "today" is passed in, which is what
// makes it testable without mocking time and identical on the server, in a
// cron job, or in NestJS after the split.

const KERALA_TIME_ZONE = "Asia/Kolkata";

/** Today's date in Kerala, as yyyy-mm-dd. */
export function todayInKerala(now: Date = new Date()): string {
    // "en-CA" is simply the locale that formats dates as yyyy-mm-dd.
    return now.toLocaleDateString("en-CA", { timeZone: KERALA_TIME_ZONE });
}

/**
 * Whole years completed between `dob` and `asOf` (default: today in Kerala).
 *
 * Compared on UTC components after both dates are reduced to a plain
 * calendar date, so this cannot be off by one for a caller in another
 * timezone or around midnight.
 */
export function calculateAge(dob: Date, asOf: string = todayInKerala()): number {
    const today = new Date(asOf);

    let age = today.getUTCFullYear() - dob.getUTCFullYear();

    const hadBirthdayThisYear =
        today.getUTCMonth() > dob.getUTCMonth() ||
        (today.getUTCMonth() === dob.getUTCMonth() &&
            today.getUTCDate() >= dob.getUTCDate());

    if (!hadBirthdayThisYear) age--;

    return age;
}
