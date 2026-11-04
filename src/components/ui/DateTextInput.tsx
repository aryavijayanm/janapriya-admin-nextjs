"use client";

import { Input } from "@/components/ui/Input";

/** "05112026" -> "05/11/2026": digits only, slashes added as you type. */
export function formatDateTyping(text: string): string {
    const digits = text.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) return digits;
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

interface DateTextInputProps {
    id: string;
    /** What's typed, DD/MM/YYYY (possibly unfinished). Convert with parseDayMonthYear() before saving. */
    value: string;
    onChange: (value: string) => void;
}

// A date typed as DD/MM/YYYY in a plain text box -- quicker than picking from
// a calendar every time (owner's request). Only digits can be typed; the
// slashes appear by themselves. On phones it opens the number keypad.
export function DateTextInput({ id, value, onChange }: DateTextInputProps) {
    return (
        <Input
            id={id}
            inputMode="numeric"
            autoComplete="off"
            placeholder="DD/MM/YYYY"
            maxLength={10}
            value={value}
            onChange={(e) => onChange(formatDateTyping(e.target.value))}
        />
    );
}
