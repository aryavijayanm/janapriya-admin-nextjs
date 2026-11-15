import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatRupees } from "@/lib/money";
import type { StaffBalanceTotals } from "@/server/services/staff-balance.service";
import { BALANCE_MONEY_LABELS } from "@/server/validators/staff-balance";

/** One total that opens the balances page already filtered. amount null = not shown. */
function Total({ href, label, amount, staff, tone }: { href: string; label: string; amount: number | null; staff: number; tone: string }) {
    return (
        <Link href={href} className="dashboard-tile transition-colors hover:bg-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            {amount !== null && <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{formatRupees(amount)}</p>}
            {/* Without the amount, the staff count becomes the big number. */}
            <p className={amount !== null ? "text-xs text-gray-500" : "mt-1 text-xl font-bold tabular-nums text-gray-900"}>
                {staff} staff
            </p>
        </Link>
    );
}

// Dashboard card for the staff balances look-up. Everyone sees the two
// headings with how many staff are in each, each opening the filtered list;
// the Owner also sees the amounts (the service leaves them out for others).
// Totals are two sums over the stored balances -- instant at any number of staff.
export function StaffBalancesCard({ totals }: { totals: StaffBalanceTotals }) {
    return (
        <Card variant="dashboard" tone="purple">
            <Link href="/staff/balances" className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <Wallet className="w-5 h-5 text-primary" />
                    Staff balances
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <div className="mt-4 grid grid-cols-2 gap-3">
                <Total
                    href="/staff/balances?money=owed"
                    label={BALANCE_MONEY_LABELS.owed}
                    amount={totals.owedToStaff.amount}
                    staff={totals.owedToStaff.staff}
                    tone="text-gray-900"
                />
                <Total
                    href="/staff/balances?money=owes"
                    label={BALANCE_MONEY_LABELS.owes}
                    amount={totals.staffOwes.amount}
                    staff={totals.staffOwes.staff}
                    tone="text-amber-700"
                />
            </div>
            <p className="mt-3 text-xs text-gray-500">Estimated until yesterday.</p>
        </Card>
    );
}
