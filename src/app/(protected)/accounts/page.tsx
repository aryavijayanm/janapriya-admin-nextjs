import { redirect } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { getAccountDay, listAccountBook } from "@/server/services/account-book.service";
import { accountBookQuerySchema } from "@/server/validators/account-book";
import { todayInKerala } from "@/server/domain/age";
import { AccountsBook } from "@/features/accounts/AccountsBook";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The accounts book. Thin: gate, read ?day= and ?page=, fetch, hand over.
// OUTSIDER is sent to the dashboard here (UX); the service refuses them too
// (security -- the actions can be called without loading this page).
export default async function AccountsPage({ searchParams }: { searchParams: SearchParams }) {
    const { db, user } = await requireUser();
    if (user.role === "OUTSIDER") redirect("/dashboard");

    // A repeated param (?page=1&page=2) arrives as an array; take the first.
    const raw = Object.fromEntries(
        Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    );
    const query = accountBookQuerySchema.parse(raw);

    const today = todayInKerala();
    // No future days: a typed-in future ?day= simply shows today.
    const day = query.day && query.day <= today ? query.day : today;
    const monthStart = `${today.slice(0, 8)}01`;

    const [dayData, month] = await Promise.all([
        getAccountDay(db, user, day),
        listAccountBook(db, user, { from: monthStart, to: today }, query.page),
    ]);

    return (
        <AccountsBook
            day={day}
            today={today}
            dayData={dayData}
            monthRows={month.data}
            monthPagination={month.pagination}
            canExport={user.role === "OWNER"}
        />
    );
}
