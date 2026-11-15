export const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
];

// Sunday-first, matching the project's original calendar convention.
export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// One array representing a month's calendar grid: leading `null`s for the
// weekday offset before the 1st, then one Date per day of the month. Shared
// by the main grid and both mini grids so this math exists exactly once.
export function getMonthCells(year: number, month: number): (Date | null)[] {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
        cells.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        cells.push(new Date(year, month, day));
    }
    return cells;
}

/**
 * A grid cell as yyyy-mm-dd. The cells are built from plain year / month /
 * day numbers, so this reads those same numbers back -- no timezone can
 * shift the date (toISOString() could, on a computer set to another zone).
 */
export function cellToIsoDate(date: Date): string {
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${mm}-${dd}`;
}

export function isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
}
