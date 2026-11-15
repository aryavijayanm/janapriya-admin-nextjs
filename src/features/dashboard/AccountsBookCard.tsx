import { BookOpen, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { formatRupees } from "@/lib/money";
import type { AccountDay } from "@/server/services/account-book.service";

function Total({ label, amount, tone }: { label: string; amount: number; tone: string }) {
    return (
        <div className="dashboard-tile">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
            <p className={`mt-1 text-xl font-bold tabular-nums ${tone}`}>{formatRupees(amount)}</p>
        </div>
    );
}

// Dashboard card for the accounts book: today's Receipts and Payments (voided
// rows don't count -- same totals as the book's day card). The whole card
// opens the book. Not shown to OUTSIDER (they can't open the book).
export function AccountsBookCard({ today }: { today: AccountDay }) {
    return (
        <Card variant="dashboard" tone="coral" href="/accounts">
            <span className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-lg font-bold text-gray-900">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Accounts book
                </span>
                <ChevronRight className="w-5 h-5 text-gray-400" />
            </span>
            <span className="mt-4 grid grid-cols-2 gap-3">
                <Total label="Receipts" amount={today.totalIn} tone="text-green-700" />
                <Total label="Payments" amount={today.totalOut} tone="text-red-700" />
            </span>
            <span className="mt-3 block text-xs text-gray-500">Today</span>
        </Card>
    );
}
