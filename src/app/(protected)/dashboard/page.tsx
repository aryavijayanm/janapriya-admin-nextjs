import { ClipboardCheck, ClipboardList, HeartHandshake, Users } from "lucide-react";
import { requireUser } from "@/app/_lib/session";
import { getStaffBalanceTotals } from "@/server/services/staff-balance.service";
import { getPaymentsSummary } from "@/server/services/payments-list.service";
import { getAccountDay } from "@/server/services/account-book.service";
import { getDayActivityCounts } from "@/server/services/activities.service";
import { getOwnerTotals } from "@/server/services/dashboard.service";
import { todayInKerala } from "@/server/domain/age";
import { StaffBalancesCard } from "@/features/dashboard/StaffBalancesCard";
import { PaymentsCard } from "@/features/dashboard/PaymentsCard";
import { AccountsBookCard } from "@/features/dashboard/AccountsBookCard";
import { ActivitiesCard } from "@/features/dashboard/ActivitiesCard";
import { QuickCard } from "@/features/dashboard/QuickCard";

// The dashboard is its own slice: customer payments, staff balances, the
// accounts book and today's activities. Each card reads only stored/indexed
// data, so the page stays fast as the business grows.
export default async function DashboardPage() {
    const { db, user } = await requireUser();
    const today = todayInKerala();

    const isOwner = user.role === "OWNER";

    const [payments, totals, accountsToday, activityCounts, ownerTotals] = await Promise.all([
        getPaymentsSummary(db, user),
        // Staff counts for everyone; the service adds the amounts for the Owner only.
        getStaffBalanceTotals(db, user),
        // The accounts book: everyone except OUTSIDER (same rule as the book itself).
        user.role !== "OUTSIDER" ? getAccountDay(db, user, today) : Promise.resolve(null),
        getDayActivityCounts(db, user, today),
        // The four small boxes: Owner only.
        isOwner ? getOwnerTotals(db, user) : Promise.resolve(null),
    ]);

    // A big card's cell: 2 columns wide in the Owner's grid (see below).
    const bigCell = isOwner ? "col-span-2 order-1 xl:order-none" : "";

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
            {/* ONE grid for every box. auto-rows-fr makes every row the same
                height (the tallest card's), and each box fills its cell -- so a
                small box is always exactly as tall as a big card, on any screen.

                Owner, wide (6 narrow columns; a big card spans 2, a small box 1
                -> 3 equal-width columns, the first holding two small boxes):
                    [pink][magenta] [Customer payments ] [Staff balances]
                    [purple][coral] [Activities        ] [Accounts book ]
                Owner, tablet (4 columns): the 4 small boxes in one row, then
                the big cards 2 per row. Phone (2 columns): small boxes 2 x 2,
                then one big card per row. Below "xl" the big cards get order-1,
                so all the small boxes come first; from "xl" they go back to the
                written order (order-none), which gives the layout above.
                Everyone else: just the big cards, 2 per row (1 on a phone). */}
            <div
                className={
                    isOwner
                        // minmax(12rem, 1fr): every row at least 12rem (192px) tall,
                        // still all equal -- room for the big numbers in the small boxes.
                        ? "grid auto-rows-[minmax(12rem,1fr)] grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6"
                        : "grid auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2"
                }
            >
                {ownerTotals && <QuickCard colour="pink" icon={Users} label="Customers" value={ownerTotals.customers} note="incl. disabled" />}
                {ownerTotals && <QuickCard colour="magenta" icon={HeartHandshake} label="Staff" value={ownerTotals.staff} note="incl. disabled" />}
                <div className={bigCell}>
                    <PaymentsCard summary={payments} />
                </div>
                <div className={bigCell}>
                    <StaffBalancesCard totals={totals} />
                </div>
                {ownerTotals && <QuickCard colour="sky" icon={ClipboardCheck} label="Active orders" value={ownerTotals.activeOrders} note="running now" />}
                {ownerTotals && <QuickCard colour="coral" icon={ClipboardList} label="All orders" value={ownerTotals.allOrders} note="so far" />}
                <div className={bigCell}>
                    <ActivitiesCard counts={activityCounts} />
                </div>
                {accountsToday && (
                    <div className={bigCell}>
                        <AccountsBookCard today={accountsToday} />
                    </div>
                )}
            </div>
        </div>
    );
}
