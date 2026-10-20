// The contract-dates rule, as a pure function: no database, no Next.js.
//
// A contract is 28 days of SERVICE, not 28 calendar days. A day counts only if
// some staff duty period covers it (any part of it -- half days still count),
// so a gap with no staff stretches the contract. Only contract #1's start date
// is ever typed in; every end date, and every later start date, is worked out
// here from the duty periods:
//
//   #1 start = typed at "Start care"
//   #1 end   = the day the 28th served day is reached
//   #2 start = the day after #1 ends, and so on
//
// If coverage runs out (staff stopped, nobody assigned yet), the current
// contract's end is PENDING (null) and any later contracts have no dates yet.
//
// Pure, so it can be tested with plain examples and moves to NestJS unchanged.

import { fromDayNumber, toDayNumber } from "./days";

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

/** A duty period, as far as dates are concerned. endDate null = still working. */
export interface DutyDates {
    startDate: Date;
    endDate: Date | null;
}

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
    const periods = duties.map((duty) => ({
        start: toDayNumber(duty.startDate),
        end: duty.endDate === null ? Number.POSITIVE_INFINITY : toDayNumber(duty.endDate),
    }));

    // The last day any period covers (Infinity if someone is still working).
    // Once the walk passes it, no later day can ever be served.
    const lastCoveredDay = periods.reduce((latest, p) => Math.max(latest, p.end), Number.NEGATIVE_INFINITY);

    const isServed = (day: number) => periods.some((p) => p.start <= day && day <= p.end);

    const results: CalculatedContractDates[] = [];
    let day = toDayNumber(firstStartDate);
    let pending = false;

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
