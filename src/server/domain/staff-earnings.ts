// What a staff member earned from duty, as pure functions: no database, no
// Next.js. Earned is never stored -- it's worked out from the facts every
// time (duty periods x the contract's staff salary), so a corrected duty date
// corrects the money by itself.
//
// The rule (owner's decision):
//   daily rate = contract staff salary / 28
//   Full day = 1 day, Half day = 1/2 day, No pay = 0
//   each day is paid at the salary of the contract that day belongs to
//
// Half days are counted as "half-days" (Full = 2, Half = 1) so everything
// stays whole numbers until the final rounding:
//   earned = floor(staffSalary x halfDays / 56)        (56 = 28 days x 2)
// e.g. Rs 20,000, 10 full + 1 half = 21 half-days -> floor(20,000 x 21 / 56) = Rs 7,500
//
// Settled vs To settle: one row per duty period x contract. Each clearing
// stores what has been paid so far for that row (StaffSettledDuty). "To
// settle" = what the row is worth NOW minus what was paid -- so late duty,
// a corrected date or a moved contract boundary all show up by themselves.

import { fromDayNumber, toDayNumber } from "./days";
import { dayPartOn, type DutyDayFacts } from "./duty";
import { SERVICE_DAYS_PER_CONTRACT } from "./contract-dates";

const HALF_DAYS_PER_CONTRACT = SERVICE_DAYS_PER_CONTRACT * 2;

/** One of the staff member's duty periods (any order). */
export interface StaffDuty extends DutyDayFacts {
    dutyId: number;
    orderId: number;
}

/** A contract of an order, as far as salary is concerned. */
export interface SalaryContract {
    contractNumber: number;
    startDate: Date | null;
    endDate: Date | null;
    staffSalary: number;
}

/** What one duty period x contract is worth now (all its days up to today). */
export interface DutyEarning {
    dutyId: number;
    orderId: number;
    contractNumber: number;
    staffSalary: number;
    /** First and last day worked (paid or not) in this contract. */
    fromDate: Date;
    toDate: Date;
    /** Days x 2 (Full = 2, Half = 1, No pay = 0). */
    halfDays: number;
    amount: number;
}

/** What has been paid so far for one duty x contract (the latest StaffSettledDuty row). */
export interface SettledState {
    dutyId: number;
    orderId: number;
    contractNumber: number;
    staffSalary: number;
    settledFrom: Date | null;
    settledTo: Date | null;
    settledHalfDays: number;
    settledAmount: number;
}

/** One "To settle" line: the difference still to be paid (minus = paid too much). */
export interface ToSettleRow {
    dutyId: number;
    orderId: number;
    contractNumber: number;
    /** The salary it's worked out at now (or the one it was paid at, when fully reversed). */
    staffSalary: number;
    /** Which days the difference is about -- a description; halfDays/amount are exact. */
    fromDate: Date;
    toDate: Date;
    halfDays: number;
    amount: number;
    /** The row's state after this is settled (written by the next clearing). */
    after: { settledFrom: Date | null; settledTo: Date | null; settledHalfDays: number; settledAmount: number };
}

/** Whole rupees, rounded down (the project rule for money). */
export function earnedFor(staffSalary: number, halfDays: number): number {
    return Math.floor((staffSalary * halfDays) / HALF_DAYS_PER_CONTRACT);
}

/**
 * The contract a day belongs to: the one covering it; else the latest one
 * started before it (a day past the latest contract's end, when the next
 * contract hasn't been created yet, is paid at the latest salary -- a late
 * contract row must never mean missing pay). Null before contract #1.
 */
function contractForDay(contracts: SalaryContract[], day: number): SalaryContract | null {
    let latestStarted: SalaryContract | null = null;
    for (const c of contracts) {
        if (c.startDate === null) continue;
        const start = toDayNumber(c.startDate);
        if (start > day) continue;
        if (c.endDate === null || day <= toDayNumber(c.endDate)) return c;
        if (!latestStarted || start > toDayNumber(latestStarted.startDate!)) latestStarted = c;
    }
    return latestStarted;
}

/** Key of a duty x contract row. */
export const settleKey = (dutyId: number, contractNumber: number) => `${dutyId}#${contractNumber}`;

/**
 * What every duty period x contract is worth now: all days of each duty up to
 * and including `uptoDay` (today). Ordered by first day.
 */
export function calculateDutyEarnings(
    duties: StaffDuty[],
    contractsByOrder: Map<number, SalaryContract[]>,
    uptoDay: number,
): DutyEarning[] {
    const rows = new Map<string, { duty: StaffDuty; contract: SalaryContract; first: number; last: number; halfDays: number }>();

    for (const duty of duties) {
        const contracts = contractsByOrder.get(duty.orderId) ?? [];
        const from = toDayNumber(duty.startDate);
        const to = Math.min(duty.endDate === null ? Number.POSITIVE_INFINITY : toDayNumber(duty.endDate), uptoDay);

        for (let day = from; day <= to; day++) {
            const contract = contractForDay(contracts, day);
            if (!contract) continue; // before care started (a leading no-pay day)

            const part = dayPartOn(duty, day);
            const halfDays = part === "FULL" ? 2 : part === "HALF" ? 1 : 0;

            const key = settleKey(duty.dutyId, contract.contractNumber);
            const row = rows.get(key);
            if (row) {
                row.last = day; // days are walked in order
                row.halfDays += halfDays;
            } else {
                rows.set(key, { duty, contract, first: day, last: day, halfDays });
            }
        }
    }

    return [...rows.values()]
        .sort((a, b) => a.first - b.first || a.duty.dutyId - b.duty.dutyId)
        .map((r) => ({
            dutyId: r.duty.dutyId,
            orderId: r.duty.orderId,
            contractNumber: r.contract.contractNumber,
            staffSalary: r.contract.staffSalary,
            fromDate: fromDayNumber(r.first),
            toDate: fromDayNumber(r.last),
            halfDays: r.halfDays,
            amount: earnedFor(r.contract.staffSalary, r.halfDays),
        }));
}

/**
 * Which days a difference is about, for the To settle line:
 *   start same, end moved   -> the added days (or the removed ones)
 *   end same, start moved   -> likewise at the front
 *   anything else           -> the whole period as it is now
 *                              (day part changed, salary changed, both ends moved)
 */
function changedDays(nowFrom: number, nowTo: number, paidFrom: number, paidTo: number): [number, number] {
    if (nowFrom === paidFrom && nowTo !== paidTo) {
        return nowTo > paidTo ? [paidTo + 1, nowTo] : [nowTo + 1, paidTo];
    }
    if (nowTo === paidTo && nowFrom !== paidFrom) {
        return nowFrom < paidFrom ? [nowFrom, paidFrom - 1] : [paidFrom, nowFrom - 1];
    }
    return [nowFrom, nowTo];
}

/**
 * To settle = now - paid, per duty x contract. A row whose money and days are
 * unchanged is Settled and left out (a date that moved without changing the
 * money -- e.g. a No pay day shifted -- doesn't need paying, so it's ignored).
 * Ordered by first day.
 */
export function calculateToSettle(now: DutyEarning[], settled: SettledState[]): ToSettleRow[] {
    const paid = new Map(settled.map((s) => [settleKey(s.dutyId, s.contractNumber), s]));
    const rows: ToSettleRow[] = [];

    for (const n of now) {
        const key = settleKey(n.dutyId, n.contractNumber);
        const s = paid.get(key);
        paid.delete(key);

        const halfDays = n.halfDays - (s?.settledHalfDays ?? 0);
        const amount = n.amount - (s?.settledAmount ?? 0);
        if (halfDays === 0 && amount === 0) continue;

        const nowFrom = toDayNumber(n.fromDate);
        const nowTo = toDayNumber(n.toDate);
        const [from, to] =
            s?.settledFrom && s.settledTo
                ? changedDays(nowFrom, nowTo, toDayNumber(s.settledFrom), toDayNumber(s.settledTo))
                : [nowFrom, nowTo];

        rows.push({
            dutyId: n.dutyId,
            orderId: n.orderId,
            contractNumber: n.contractNumber,
            staffSalary: n.staffSalary,
            fromDate: fromDayNumber(from),
            toDate: fromDayNumber(to),
            halfDays,
            amount,
            after: { settledFrom: n.fromDate, settledTo: n.toDate, settledHalfDays: n.halfDays, settledAmount: n.amount },
        });
    }

    // Paid before, not worked any more (duty shortened past a contract,
    // moved to another staff, or the days now belong to another contract).
    for (const s of paid.values()) {
        if (s.settledHalfDays === 0 && s.settledAmount === 0) continue;
        if (!s.settledFrom || !s.settledTo) continue; // can't happen: paid rows have dates
        rows.push({
            dutyId: s.dutyId,
            orderId: s.orderId,
            contractNumber: s.contractNumber,
            staffSalary: s.staffSalary,
            fromDate: s.settledFrom,
            toDate: s.settledTo,
            halfDays: -s.settledHalfDays,
            amount: -s.settledAmount,
            after: { settledFrom: null, settledTo: null, settledHalfDays: 0, settledAmount: 0 },
        });
    }

    return rows.sort((a, b) => toDayNumber(a.fromDate) - toDayNumber(b.fromDate) || a.dutyId - b.dutyId);
}
