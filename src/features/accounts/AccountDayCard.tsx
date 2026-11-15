"use client";

import type { TableColumn } from "@/components/ui/Table";
import { DayNav } from "@/components/ui/DayNav";
import { AccountDaySummary } from "@/features/accounts/AccountDaySummary";
import type { AccountBookRow, AccountDay } from "@/server/services/account-book.service";

interface AccountDayCardProps {
    /** The day shown, yyyy-mm-dd. */
    day: string;
    /** Today in Kerala, yyyy-mm-dd -- Next stops here (no future days in the book). */
    today: string;
    data: AccountDay;
    columns: TableColumn<AccountBookRow>[];
}

// The accounts book's day card: the shared day buttons (stopping at today)
// over the shared Receipts / Payments / Net summary and the day's rows.
export function AccountDayCard({ day, today, data, columns }: AccountDayCardProps) {
    return (
        <section className="bg-white rounded-lg shadow-md p-4 sm:p-6 space-y-4">
            <DayNav day={day} today={today} allowFuture={false} />
            <div>
                <AccountDaySummary data={data} columns={columns} />
            </div>
        </section>
    );
}
