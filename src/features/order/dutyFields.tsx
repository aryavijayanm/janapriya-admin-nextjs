"use client";

import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";

// Small inputs shared by the order dialogs (Start care, Update duty, Edit
// duty, contract money) -- written once instead of in each dialog.

export type DayPartValue = "FULL" | "HALF";

/** "Full day" / "Half day" for the first or last day of a duty period. */
export function DayPartSelect({
    id,
    value,
    onChange,
}: {
    id: string;
    value: DayPartValue;
    onChange: (value: DayPartValue) => void;
}) {
    return (
        <Select id={id} value={value} onChange={(e) => onChange(e.target.value as DayPartValue)}>
            <option value="FULL">Full day</option>
            <option value="HALF">Half day</option>
        </Select>
    );
}

/**
 * A rupee amount box. Whole rupees only: anything that isn't digits is
 * ignored as you type. Hands back a number (NaN while empty, which the Zod
 * check then reports as "required").
 */
export function RupeesInput({
    id,
    value,
    onChange,
}: {
    id: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <div className="relative">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm pointer-events-none">
                ₹
            </span>
            <Input
                id={id}
                inputMode="numeric"
                value={Number.isNaN(value) ? "" : String(value)}
                onChange={(e) => {
                    const text = e.target.value;
                    if (text === "") onChange(Number.NaN);
                    else if (/^\d+$/.test(text)) onChange(Number(text));
                }}
                className="pl-8"
                placeholder="0"
            />
        </div>
    );
}
