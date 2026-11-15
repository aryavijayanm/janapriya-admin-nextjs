"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { DayNav } from "@/components/ui/DayNav";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import type { DayActivities } from "@/server/services/activities.service";
import { ACTIVITY_TAB_LABELS, type ActivityTab } from "@/server/validators/activities";
import { AccountDaySummary } from "@/features/accounts/AccountDaySummary";
import { accountColumns } from "@/features/accounts/accountColumns";
import { OrderActivityList, StaffActivityList } from "@/features/activities/ActivityLists";

interface ActivitiesViewProps {
    /** yyyy-mm-dd, from the server. */
    day: string;
    today: string;
    tab: ActivityTab;
    activities: DayActivities;
}

// Read-only, no Edit / Delete: money is changed in the accounts book.
const MONEY_COLUMNS = accountColumns({ showDate: false });

// The activities page: one day (‹ Previous / Today / Next ›, future days
// allowed), as three tabs with their counts. The tab lives in the URL
// (?tab=staff), like the day, so refresh and Back keep both.
export function ActivitiesView({ day, today, tab, activities }: ActivitiesViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    const tabs: TabItem<ActivityTab>[] = [
        { key: "orders", label: ACTIVITY_TAB_LABELS.orders, count: activities.orders.length },
        { key: "staff", label: ACTIVITY_TAB_LABELS.staff, count: activities.staff.length },
        // No money tab for those who don't see money (the service sends null).
        ...(activities.money ? [{ key: "money" as const, label: ACTIVITY_TAB_LABELS.money, count: activities.money.rows.length }] : []),
    ];
    // A ?tab=money link opened by someone without money access shows Orders.
    const current = tabs.some((t) => t.key === tab) ? tab : "orders";

    const setTab = (key: ActivityTab) => {
        const params = new URLSearchParams(searchParams.toString());
        if (key === "orders") params.delete("tab");
        else params.set("tab", key);
        router.push(`?${params.toString()}`, { scroll: false });
    };

    return (
        <div className="space-y-6">
            <Card variant="section" as="section" className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800">ACTIVITIES</h2>
                <DayNav day={day} today={today} allowFuture />
            </Card>

            <Card variant="section" as="section" className="space-y-4">
                <Tabs tabs={tabs} value={current} onChange={setTab} />
                {current === "orders" && <OrderActivityList items={activities.orders} future={day > today} />}
                {current === "staff" && <StaffActivityList items={activities.staff} />}
                {current === "money" && activities.money && <AccountDaySummary data={activities.money} columns={MONEY_COLUMNS} />}
            </Card>
        </div>
    );
}
