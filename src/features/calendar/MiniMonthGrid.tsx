import { getMonthCells, isWeekend, MONTH_NAMES, WEEKDAY_NAMES } from "./monthGrid";

interface MiniMonthGridProps {
    year: number;
    month: number;
    label: string;
}

// Small, non-interactive reference calendar -- no click handlers, no "today"
// highlight at this size. Shares its date math with the main grid via monthGrid.ts.
export function MiniMonthGrid({ year, month, label }: MiniMonthGridProps) {
    const cells = getMonthCells(year, month);

    return (
        <div className="flex flex-col gap-1.5">
            <div className="text-xs font-extrabold uppercase tracking-wide text-gray-500">
                {label} — {MONTH_NAMES[month]} {year}
            </div>

            <div className="grid grid-cols-7">
                {WEEKDAY_NAMES.map((day) => (
                    <div key={day} className="text-center text-[9px] font-extrabold tracking-wide text-gray-400">
                        {day[0]}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {cells.map((date, i) => (
                    <div
                        key={date ? date.toISOString() : `empty-${i}`}
                        className={`text-center text-[11px] font-bold py-0.5 rounded ${date && isWeekend(date) ? "text-red-600" : "text-gray-800"
                            }`}
                    >
                        {date ? date.getDate() : ""}
                    </div>
                ))}
            </div>
        </div>
    );
}
