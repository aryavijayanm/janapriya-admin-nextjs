"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Table, type TableColumn } from "@/components/ui/Table";
import { formatDate, shiftIsoDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import type { AccountBookRow, AccountDay } from "@/server/services/account-book.service";

interface AccountDayCardProps {
    /** The day shown, yyyy-mm-dd. */
    day: string;
    /** Today in Kerala, yyyy-mm-dd -- the › button stops here (no future days). */
    today: string;
    data: AccountDay;
    columns: TableColumn<AccountBookRow>[];
}

function Total({ label, amount, className }: { label: string; amount: string; className: string }) {
    return (
        <div className="rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${className}`}>{amount}</p>
        </div>
    );
}

// One day of the book: ‹ and › move a day back or forward (the day lives in
// the URL as ?day=, so Back/refresh keep it). Shows the day's Receipts,
// Payments and Net -- voided rows don't count -- and every row of the day, voided ones
// crossed out.
export function AccountDayCard({ day, today, data, columns }: AccountDayCardProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isToday = day === today;

    const goTo = (newDay: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (newDay === today) params.delete("day");
        else params.set("day", newDay);
        router.push(`?${params.toString()}`, { scroll: false });
    };

    const net = data.totalIn - data.totalOut;

    return (
        <section className="bg-white rounded-lg shadow-md p-4 sm:p-6">
            <div className="flex items-center justify-between gap-2 mb-4">
                <Button variant="secondary" size="sm" onClick={() => goTo(shiftIsoDate(day, -1))} aria-label="Previous day">
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                </Button>
                <h3 className="text-lg font-bold text-gray-800 text-center">
                    {isToday ? "Today, " : ""}
                    {formatDate(day)}
                </h3>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => goTo(shiftIsoDate(day, 1))}
                    disabled={isToday}
                    aria-label="Next day"
                >
                    Next
                    <ChevronRight className="w-4 h-4" />
                </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <Total label="Receipts" amount={formatRupees(data.totalIn)} className="text-green-700" />
                <Total label="Payments" amount={formatRupees(data.totalOut)} className="text-red-700" />
                <Total
                    label="Net (Receipts − Payments)"
                    amount={`${net < 0 ? "−" : ""}${formatRupees(Math.abs(net))}`}
                    className={net < 0 ? "text-red-700" : "text-gray-900"}
                />
            </div>

            <Table
                columns={columns}
                data={data.rows}
                getRowKey={(row) => `${row.source}-${row.id}`}
                emptyMessage="Nothing on this day."
            />
        </section>
    );
}
