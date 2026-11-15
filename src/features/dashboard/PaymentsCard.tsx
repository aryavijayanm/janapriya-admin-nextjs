import Link from "next/link";
import { ChevronRight, CreditCard } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatRupees } from "@/lib/money";
import type { PaymentsSummary } from "@/server/services/payments-list.service";

/**
 * One box that opens the payments table already filtered. With an amount
 * (Owner): the rupees big, the order count small under it -- same layout as
 * the Staff balances card. Without: the count is the big number.
 */
function Count({ href, label, count, amount = null, tone }: { href: string; label: string; count: number; amount?: number | null; tone: string }) {
    return (
        <Link href={href} className="dashboard-tile transition-colors hover:bg-white">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            {amount !== null ? (
                <>
                    <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{formatRupees(amount)}</p>
                    <p className="text-xs text-gray-500">{count} orders</p>
                </>
            ) : (
                <>
                    <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{count}</p>
                    <p className="text-xs text-gray-500">orders</p>
                </>
            )}
        </Link>
    );
}

// Dashboard card for the payments table: how many orders still have money to
// collect (everyone; the Owner also sees the total), and -- Owner only -- how
// many have a refund to give. Indexed queries with the same conditions as the
// table's filters.
export function PaymentsCard({ summary }: { summary: PaymentsSummary }) {
    return (
        <Card variant="dashboard" tone="magenta">
            <Link href="/payments" className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Customer payments
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <div className={`mt-4 grid gap-3 ${summary.toRefund !== null ? "grid-cols-2" : "grid-cols-1"}`}>
                {/* "Not paid" + "Partly paid" together; the table opens on All, where both show. */}
                <Count
                    href="/payments"
                    label="Money to collect"
                    count={summary.toCollect}
                    amount={summary.toCollectAmount}
                    tone="text-red-700"
                />
                {summary.toRefund !== null && (
                    <Count href="/payments?status=REFUND" label="Refund to give" count={summary.toRefund} tone="text-amber-700" />
                )}
            </div>
        </Card>
    );
}
