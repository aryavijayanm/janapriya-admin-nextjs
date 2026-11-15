import { requireUser } from "@/app/_lib/session";
import { getStaffBalanceTotals } from "@/server/services/staff-balance.service";
import { getPaymentsSummary } from "@/server/services/payments-list.service";
import { getAccountDay } from "@/server/services/account-book.service";
import { getDayActivityCounts } from "@/server/services/activities.service";
import { todayInKerala } from "@/server/domain/age";
import { StaffBalancesCard } from "@/features/dashboard/StaffBalancesCard";
import { PaymentsCard } from "@/features/dashboard/PaymentsCard";
import { AccountsBookCard } from "@/features/dashboard/AccountsBookCard";
import { ActivitiesCard } from "@/features/dashboard/ActivitiesCard";

// The dashboard is its own slice: customer payments, staff balances, the
// accounts book and today's activities. Each card reads only stored/indexed
// data, so the page stays fast as the business grows.
export default async function DashboardPage() {
    const { db, user } = await requireUser();
    const today = todayInKerala();

    const [payments, totals, accountsToday, activityCounts] = await Promise.all([
        getPaymentsSummary(db, user),
        // Money totals are for the Owner only; everyone else sees the card name.
        user.role === "OWNER" ? getStaffBalanceTotals(db, user) : Promise.resolve(null),
        // The accounts book: everyone except OUTSIDER (same rule as the book itself).
        user.role !== "OUTSIDER" ? getAccountDay(db, user, today) : Promise.resolve(null),
        getDayActivityCounts(db, user, today),
    ]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <ActivitiesCard counts={activityCounts} />
                <PaymentsCard summary={payments} />
                <StaffBalancesCard totals={totals} />
                {accountsToday && <AccountsBookCard today={accountsToday} />}
            </div>
        </div>
    );
}
