import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";
import { formatRupees } from "@/lib/money";
import type { StaffBalanceTotals } from "@/server/services/staff-balance.service";
import { BALANCE_MONEY_LABELS } from "@/server/validators/staff-balance";

const CARD = "block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md";

/** One total that opens the balances page already filtered. */
function Total({ href, label, amount, staff, tone }: { href: string; label: string; amount: number; staff: number; tone: string }) {
    return (
        <Link href={href} className="rounded-lg bg-gray-50 px-4 py-3 hover:bg-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{formatRupees(amount)}</p>
            <p className="text-xs text-gray-500">
                {staff} staff
            </p>
        </Link>
    );
}

// Dashboard card for the staff balances look-up.
//   Owner  -> totals (amount to staff / amount from staff, with counts), each opening the filtered list
//   others -> just the card name, opening the list
// Totals are two sums over the stored balances -- instant at any number of staff.
export function StaffBalancesCard({ totals }: { totals: StaffBalanceTotals | null }) {
    const title = (
        <span className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Wallet className="w-5 h-5 text-primary" />
            Staff balances
        </span>
    );

    if (!totals) {
        return (
            <Link href="/staff/balances" className={`${CARD} flex items-center justify-between`}>
                {title}
                <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
        );
    }

    return (
        <div className={CARD}>
            <Link href="/staff/balances" className="flex items-center justify-between">
                {title}
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
        </div>
    );
}
