import { requireUser } from "@/app/_lib/session";
import { getStaffBalanceTotals } from "@/server/services/staff-balance.service";
import { StaffBalancesCard } from "@/features/dashboard/StaffBalancesCard";

// The dashboard is its own slice; for now it holds the staff balances card.
// Each card reads only stored/indexed data, so the page stays fast as the
// business grows.
export default async function DashboardPage() {
    const { db, user } = await requireUser();

    // Money totals are for the Owner only; everyone else sees the card name.
    const totals = user.role === "OWNER" ? await getStaffBalanceTotals(db, user) : null;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                <StaffBalancesCard totals={totals} />
            </div>
        </div>
    );
}
