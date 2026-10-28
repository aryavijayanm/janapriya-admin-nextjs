// Rules about staff duty periods, as pure functions: no database, no Next.js.
//
// Only facts are stored for a duty period (who, from when, until when, full
// or half days). These rules answer the two questions the app keeps asking
// about those facts:
//   1. Do two periods clash?        -> double booking check
//   2. Which days had no staff?     -> gaps (leave without cover) on an order

import { fromDayNumber, toDayNumber } from "./days";

// FULL / HALF = worked (and paid) that day. NO_PAY = there, but not paid and
// not counted -- e.g. joined late in the evening, or left early morning. Only
// the first and last day of a period have a part; days in between are FULL.
export type DayPartValue = "FULL" | "HALF" | "NO_PAY";

export interface DutyPeriodFacts {
    staffId: number;
    startDate: Date;
    startDayPart: DayPartValue;
    endDate: Date | null; // null = still working
    endDayPart: DayPartValue | null;
}

/** Only the dates and day parts -- what the contract-dates rule needs. */
export type DutyDayFacts = Omit<DutyPeriodFacts, "staffId">;

function span(period: DutyDayFacts): { start: number; end: number } {
    return {
        start: toDayNumber(period.startDate),
        end: period.endDate === null ? Number.POSITIVE_INFINITY : toDayNumber(period.endDate),
    };
}

// Lowest first: on a 1-day period with two different choices, the lower one
// wins -- a forgotten "Full" in the stop box can't turn an unpaid day paid.
const PART_RANK: Record<DayPartValue, number> = { NO_PAY: 0, HALF: 1, FULL: 2 };

/**
 * What a period counts as on one day it covers: its start part on its first
 * day, its end part on its last day, FULL on every day in between.
 */
export function dayPartOn(period: DutyDayFacts, day: number): DayPartValue {
    const { start, end } = span(period);
    const startPart = day === start ? period.startDayPart : null;
    const endPart = day === end ? (period.endDayPart ?? "FULL") : null;
    if (startPart && endPart) return PART_RANK[startPart] <= PART_RANK[endPart] ? startPart : endPart;
    return startPart ?? endPart ?? "FULL";
}

/** Was this day worked and paid (FULL or HALF) under this period? */
export function isPaidDay(period: DutyDayFacts, day: number): boolean {
    const { start, end } = span(period);
    return start <= day && day <= end && dayPartOn(period, day) !== "NO_PAY";
}

/**
 * Do two duty periods clash (the same person can't be in two places, and an
 * order can't have two staff on duty at once)? Used for BOTH checks: two
 * periods of one staff member (any orders), and two periods on one order.
 *
 * They may share at most ONE day, and only like this:
 *   HALF   + HALF            -> a half-day handover (leaves at noon, other starts)
 *   NO_PAY + anything        -> one of them is there unpaid that day
 * Anything else (FULL + FULL, FULL + HALF, or 2+ shared days) is a clash.
 */
export function dutyPeriodsClash(a: DutyPeriodFacts, b: DutyPeriodFacts): boolean {
    const x = span(a);
    const y = span(b);

    const firstShared = Math.max(x.start, y.start);
    const lastShared = Math.min(x.end, y.end);
    if (firstShared > lastShared) return false; // no day in common
    if (firstShared !== lastShared) return true; // 2+ days in common

    const partA = dayPartOn(a, firstShared);
    const partB = dayPartOn(b, firstShared);
    const allowed = partA === "NO_PAY" || partB === "NO_PAY" || (partA === "HALF" && partB === "HALF");
    return !allowed;
}

/** A run of days on an order with no staff on duty. */
export interface CoverageGap {
    from: Date;
    /** null = no staff since `from`, nobody assigned yet. */
    to: Date | null;
    /** The staff member whose period ended just before the gap. */
    staffBeforeId: number;
    /**
     * The SAME staff member came back after the gap -- so it was their leave
     * with nobody covering. (False when someone else started, or nobody yet.)
     */
    sameStaffReturned: boolean;
}

/**
 * The gaps in an order's coverage: days after care started where no duty
 * period covers the day. These are the days that stretch a contract.
 *
 * Nothing about leave is stored; it's read from the facts. If the same staff
 * member's period ends before a gap and starts again after it, the gap was
 * their leave.
 */
export function findCoverageGaps(periods: DutyPeriodFacts[]): CoverageGap[] {
    const sorted = [...periods].sort((a, b) => toDayNumber(a.startDate) - toDayNumber(b.startDate));

    const gaps: CoverageGap[] = [];
    let coveredUntil = Number.NEGATIVE_INFINITY; // last day covered so far
    let staffAtCoveredUntil = 0; // whose period reaches that day

    for (const period of sorted) {
        const { start, end } = span(period);

        if (coveredUntil !== Number.NEGATIVE_INFINITY && start > coveredUntil + 1) {
            gaps.push({
                from: fromDayNumber(coveredUntil + 1),
                to: fromDayNumber(start - 1),
                staffBeforeId: staffAtCoveredUntil,
                sameStaffReturned: staffAtCoveredUntil === period.staffId,
            });
        }

        if (end >= coveredUntil) {
            coveredUntil = end;
            staffAtCoveredUntil = period.staffId;
        }
    }

    // Everyone has stopped and nobody is assigned yet: an open-ended gap.
    if (Number.isFinite(coveredUntil)) {
        gaps.push({
            from: fromDayNumber(coveredUntil + 1),
            to: null,
            staffBeforeId: staffAtCoveredUntil,
            sameStaffReturned: false,
        });
    }

    return gaps;
}
