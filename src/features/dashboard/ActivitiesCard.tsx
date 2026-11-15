import Link from "next/link";
import { Activity, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { DayActivityCounts } from "@/server/services/activities.service";

/** One count that opens today's activities on that tab. */
function Count({ href, label, count }: { href: string; label: string; count: number }) {
    return (
        <Link href={href} className="dashboard-tile px-3 transition-colors hover:bg-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums text-gray-900">{count}</p>
        </Link>
    );
}

// Dashboard card for the activities page: how many lines each tab has today.
// Everyone sees it; the Money count only for those who see money.
export function ActivitiesCard({ counts }: { counts: DayActivityCounts }) {
    return (
        <Card variant="dashboard" tone="pink">
            <Link href="/activities" className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <Activity className="w-5 h-5 text-primary" />
                    Activities
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <div className={`mt-4 grid gap-3 ${counts.money !== null ? "grid-cols-3" : "grid-cols-2"}`}>
                <Count href="/activities" label="Orders" count={counts.orders} />
                <Count href="/activities?tab=staff" label="Staff" count={counts.staff} />
                {counts.money !== null && <Count href="/activities?tab=money" label="Money" count={counts.money} />}
            </div>
            <p className="mt-3 text-xs text-gray-500">Today</p>
        </Card>
    );
}
