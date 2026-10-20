"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Checkbox } from "@/components/ui/Checkbox";
import { formatDate } from "@/lib/date";
import { searchAssignableStaffAction } from "@/features/order/order.actions";
import type { AssignableStaff } from "@/server/services/order.service";

export interface PickedStaff {
    id: number;
    name: string;
}

interface StaffPickerProps {
    orderId: number;
    /** yyyy-mm-dd the staff would start -- "busy elsewhere" is judged on this day. */
    onDate: string;
    value: PickedStaff | null;
    onChange: (staff: PickedStaff | null) => void;
}

const SEARCH_DELAY_MS = 300;

// Searchable staff picker for Start care / Update duty. Shows Active staff who
// can do the order's services first (by rating, high to low); "Show all staff"
// adds everyone else. Staff busy on another order that day are greyed out and
// can't be picked. (Staff busy on an order hidden from this user never arrive
// here at all -- the server leaves them out.)
export function StaffPicker({ orderId, onDate, value, onChange }: StaffPickerProps) {
    const [query, setQuery] = useState("");
    const [debouncedQuery, setDebouncedQuery] = useState("");
    const [includeAll, setIncludeAll] = useState(false);
    // The last reply, labelled with the request it answered. "Loading" isn't
    // stored -- it's simply "the last reply isn't for the current request",
    // which also means a slow, out-of-date reply can never be shown.
    const [reply, setReply] = useState<{ key: string; staff: AssignableStaff[]; error: string } | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const requestKey = JSON.stringify({ orderId, onDate, includeAll, search: debouncedQuery });
    const isLoading = reply?.key !== requestKey;

    useEffect(() => {
        let current = true;
        const key = JSON.stringify({ orderId, onDate, includeAll, search: debouncedQuery });
        searchAssignableStaffAction({
            orderId,
            onDate,
            includeAll,
            search: debouncedQuery || undefined,
        }).then((result) => {
            if (!current) return; // a newer request replaced this one
            setReply(
                result.ok
                    ? { key, staff: result.staff, error: "" }
                    : { key, staff: [], error: result.error },
            );
        });
        return () => {
            current = false;
        };
    }, [orderId, onDate, includeAll, debouncedQuery]);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const handleTyping = (text: string) => {
        setQuery(text);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setDebouncedQuery(text.trim()), SEARCH_DELAY_MS);
    };

    if (value) {
        return (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-300 bg-gray-50 p-3">
                <p className="font-semibold text-gray-900">{value.name}</p>
                <Button type="button" variant="secondary" size="sm" onClick={() => onChange(null)}>
                    Change
                </Button>
            </div>
        );
    }

    const staff = reply?.staff ?? [];

    return (
        <div className="space-y-2">
            <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                    <Search className="h-4 w-4" />
                </span>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder="Search staff: name, place, phone, guardian…"
                    className="input-field pl-9"
                    autoComplete="off"
                />
                {isLoading && (
                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-400">
                        <Spinner size="sm" />
                    </span>
                )}
            </div>

            <Checkbox
                id={`staff-picker-all-${orderId}`}
                label="Show all staff (not only those who do this order's services)"
                checked={includeAll}
                onChange={() => setIncludeAll((v) => !v)}
            />

            {reply?.error && <p className="text-sm text-red-600">{reply.error}</p>}

            <ul className="max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white divide-y divide-gray-100">
                {!isLoading && staff.length === 0 && (
                    <li className="px-3 py-3 text-sm text-gray-500">No matching active staff.</li>
                )}
                {staff.map((s) => (
                    <li key={s.id}>
                        <button
                            type="button"
                            disabled={!!s.busy}
                            onClick={() => onChange({ id: s.id, name: s.name })}
                            className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                        >
                            <span className="min-w-0">
                                <span className="block text-sm font-semibold text-gray-900">
                                    {s.name}
                                    <span className="font-normal text-gray-500"> · {s.place}</span>
                                </span>
                                {s.busy ? (
                                    <span className="block text-xs text-orange-700">
                                        On order {s.busy.orderCode}{" "}
                                        {s.busy.until ? `until ${formatDate(s.busy.until)}` : "(ongoing)"}
                                    </span>
                                ) : (
                                    !s.matchesServices && (
                                        <span className="block text-xs text-gray-500">Other services</span>
                                    )
                                )}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-gray-600">
                                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                                {s.rating}/10
                            </span>
                        </button>
                    </li>
                ))}
            </ul>
        </div>
    );
}
