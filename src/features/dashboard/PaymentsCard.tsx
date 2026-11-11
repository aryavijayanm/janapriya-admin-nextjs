import Link from "next/link";
import { ChevronRight, CreditCard } from "lucide-react";
import type { PaymentsSummary } from "@/server/services/payments-list.service";

const CARD = "block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md";

/** One count that opens the payments table already filtered. */
function Count({ href, label, count, tone }: { href: string; label: string; count: number; tone: string }) {
    return (
        <Link href={href} className="rounded-lg bg-gray-50 px-4 py-3 hover:bg-gray-100">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{count}</p>
            <p className="text-xs text-gray-500">orders</p>
        </Link>
    );
}

// Dashboard card for the payments table: how many orders still have money to
// collect (everyone), and -- Owner only -- how many have a refund to give.
// Each count is one indexed count query, the same conditions as the table's filters.
export function PaymentsCard({ summary }: { summary: PaymentsSummary }) {
    return (
        <div className={CARD}>
            <Link href="/payments" className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Payments
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
            </Link>
            <div className={`mt-4 grid gap-3 ${summary.toRefund !== null ? "grid-cols-2" : "grid-cols-1"}`}>
                {/* "Not paid" + "Partly paid" together; the table opens on All, where both show. */}
                <Count href="/payments" label="Money to collect" count={summary.toCollect} tone="text-red-700" />
                {summary.toRefund !== null && (
                    <Count href="/payments?status=REFUND" label="Refund to give" count={summary.toRefund} tone="text-amber-700" />
                )}
            </div>
        </div>
    );
}
