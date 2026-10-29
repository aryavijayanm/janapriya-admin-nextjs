// The contract-dates rule, as a pure function: no database, no Next.js.
//
// A contract is 28 days of SERVICE, not 28 calendar days. A day counts only if
// some staff worked it FULL or HALF (half days still count; NO_PAY days don't),
// so a gap with no staff -- or a no-pay-only day -- stretches the contract.
// No contract date is ever typed in; all are worked out here from the duty
// periods:
//
//   #1 start = the first paid duty day
//   #1 end   = the day the 28th served day is reached
//   #2 start = the day after #1 ends, and so on
//
// If coverage runs out (staff stopped, nobody assigned yet), the current
// contract's end is PENDING (null) and any later contracts have no dates yet.
//
// Pure, so it can be tested with plain examples and moves to NestJS unchanged.

import { fromDayNumber, toDayNumber } from "./days";
import { isPaidDay, type DutyDayFacts } from "./duty";

export const SERVICE_DAYS_PER_CONTRACT = 28;

/** "Start next contract" opens this many days before the latest contract ends. */
export const NEXT_CONTRACT_WINDOW_DAYS = 2;

/**
 * The first day the next contract may be started, given the latest contract's
 * end date. One rule, used by both the order page (to show the button) and the
 * order service (to enforce it).
 */
export function nextContractOpensOn(latestContractEnd: Date): Date {
    return fromDayNumber(toDayNumber(latestContractEnd) - (NEXT_CONTRACT_WINDOW_DAYS - 1));
}

/**
 * "Leave days" of one contract: calendar days inside it that were NOT served
 * (no staff, or no-pay only) -- the same days the order page marks "not
 * counted in the contract". Calendar days minus served days:
 *   finished  -> start..end            (e.g. 31 days, 28 served = 3)
 *   pending   -> start..today          (an open gap keeps growing daily)
 * null when the contract has no dates yet.
 */
export function notCountedDays(
    contract: { startDate: Date | null; endDate: Date | null; servedDays: number },
    today: Date,
): number | null {
    if (contract.startDate === null) return null;
    const start = toDayNumber(contract.startDate);
    const last = contract.endDate !== null ? toDayNumber(contract.endDate) : toDayNumber(today);
    if (last < start) return 0;
    return Math.max(0, last - start + 1 - contract.servedDays);
}

/** A duty period's dates and first/last-day parts. endDate null = still working. */
export type DutyDates = DutyDayFacts;

export interface CalculatedContractDates {
    /** null only when an earlier contract's end is still pending. */
    startDate: Date | null;
    /** null = pending: coverage ran out before 28 served days. */
    endDate: Date | null;
    /** Served days so far, 0-28. */
    servedDays: number;
}

/**
 * Start date, end date and served days for each of `contractCount` contracts
 * of one order, given contract #1's start and all of the order's duty periods.
 */
export function calculateContractDates(
    firstStartDate: Date,
    duties: DutyDates[],
    contractCount: number,
): CalculatedContractDates[] {
    // The last day any period covers (Infinity if someone is still working).
    // Once the walk passes it, no later day can ever be served.
    const lastCoveredDay = duties.reduce(
        (latest, d) => Math.max(latest, d.endDate === null ? Number.POSITIVE_INFINITY : toDayNumber(d.endDate)),
        Number.NEGATIVE_INFINITY,
    );

    // Served = some staff worked it FULL or HALF. A NO_PAY day (joined late,
    // left early) is recorded on the duty period but never counted.
    const isServed = (day: number) => duties.some((duty) => isPaidDay(duty, day));

    const results: CalculatedContractDates[] = [];
    let day = toDayNumber(firstStartDate);
    let pending = false;

    // Contract #1 starts on the first PAID day: care that begins with a
    // no-pay day (arrived late evening) starts the contract the next day.
    // If no paid day exists yet, #1 keeps the first duty day, with end pending.
    while (day <= lastCoveredDay && !isServed(day)) day++;
    if (day > lastCoveredDay) day = toDayNumber(firstStartDate);

    for (let i = 0; i < contractCount; i++) {
        if (pending) {
            // An earlier contract never finished, so this one has no dates yet.
            results.push({ startDate: null, endDate: null, servedDays: 0 });
            continue;
        }

        const contractStart = day;
        let served = 0;
        let endDay: number | null = null;

        while (served < SERVICE_DAYS_PER_CONTRACT) {
            if (day > lastCoveredDay) {
                // Coverage has run out: the end depends on the next staff.
                pending = true;
                break;
            }
            if (isServed(day)) served++;
            if (served === SERVICE_DAYS_PER_CONTRACT) endDay = day;
            day++;
        }

        results.push({
            startDate: fromDayNumber(contractStart),
            endDate: endDay === null ? null : fromDayNumber(endDay),
            servedDays: served,
        });
        // `day` is now the day after this contract's end: the next one starts there.
    }

    return results;
}
