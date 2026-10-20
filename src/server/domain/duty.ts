// Rules about staff duty periods, as pure functions: no database, no Next.js.
//
// Only facts are stored for a duty period (who, from when, until when, full
// or half days). These rules answer the two questions the app keeps asking
// about those facts:
//   1. Do two periods clash?        -> double booking check
//   2. Which days had no staff?     -> gaps (leave without cover) on an order

import { fromDayNumber, toDayNumber } from "./days";

export type DayPartValue = "FULL" | "HALF";

export interface DutyPeriodFacts {
    staffId: number;
    startDate: Date;
    startDayPart: DayPartValue;
    endDate: Date | null; // null = still working
    endDayPart: DayPartValue | null;
}

function span(period: DutyPeriodFacts): { start: number; end: number } {
    return {
        start: toDayNumber(period.startDate),
        end: period.endDate === null ? Number.POSITIVE_INFINITY : toDayNumber(period.endDate),
    };
}

/**
 * Do two duty periods clash (the same person can't be in two places, and an
 * order can't have two staff on duty at once)?
 *
 * They may share exactly ONE day only as a half-day handover: one ends that
 * day as HALF and the other starts that same day as HALF (e.g. leaves order A
 * at noon, starts order B that afternoon). Any other overlap is a clash.
 */
export function dutyPeriodsClash(a: DutyPeriodFacts, b: DutyPeriodFacts): boolean {
    const x = span(a);
    const y = span(b);

    const overlap = x.start <= y.end && y.start <= x.end;
    if (!overlap) return false;

    const halfHandover =
        (x.end === y.start && a.endDayPart === "HALF" && b.startDayPart === "HALF") ||
        (y.end === x.start && b.endDayPart === "HALF" && a.startDayPart === "HALF");

    return !halfHandover;
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
