import { requireUser } from "@/app/_lib/session";
import { getStaffBalanceTotals } from "@/server/services/staff-balance.service";
import { getPaymentsSummary } from "@/server/services/payments-list.service";
import { StaffBalancesCard } from "@/features/dashboard/StaffBalancesCard";
import { PaymentsCard } from "@/features/dashboard/PaymentsCard";

// The dashboard is its own slice; for now it holds the payments and staff
// balances cards. Each card reads only stored/indexed data, so the page stays
// fast as the business grows.
export default async function DashboardPage() {
    const { db, user } = await requireUser();

    const [payments, totals] = await Promise.all([
        getPaymentsSummary(db, user),
        // Money totals are for the Owner only; everyone else sees the card name.
        user.role === "OWNER" ? getStaffBalanceTotals(db, user) : Promise.resolve(null),
    ]);

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <PaymentsCard summary={payments} />
                <StaffBalancesCard totals={totals} />
            </div>
        </div>
    );
}
