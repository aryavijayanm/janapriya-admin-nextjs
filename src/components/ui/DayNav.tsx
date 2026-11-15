"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDate, formatWeekday, shiftIsoDate } from "@/lib/date";

interface DayNavProps {
    /** The day shown, yyyy-mm-dd. */
    day: string;
    /** Today in Kerala, yyyy-mm-dd (from the server). */
    today: string;
    /** false = Next stops at today (the accounts book); true = any day (activities). */
    allowFuture: boolean;
}

// The day title plus ‹ Previous / Today / Next › -- shared by the accounts
// book and the activities page. The day lives in the URL as ?day= (left out
// for today), so refresh and Back keep it; other URL values (the tab) stay.
export function DayNav({ day, today, allowFuture }: DayNavProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isToday = day === today;

    const goTo = (newDay: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (newDay === today) params.delete("day");
        else params.set("day", newDay);
        router.push(`?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-gray-800">
                {isToday ? "Today" : formatWeekday(day)}, {formatDate(day)}
            </h3>
            <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => goTo(shiftIsoDate(day, -1))}>
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                </Button>
                <Button variant="secondary" size="sm" onClick={() => goTo(today)} disabled={isToday}>
                    Today
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goTo(shiftIsoDate(day, 1))}
                    disabled={!allowFuture && day >= today}
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
