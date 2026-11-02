import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import type { OrderDetails as Order } from "@/server/services/order.service";

/** "Showing the latest 5 of 12 · View all contracts →" -- only when some are hidden. */
export function ViewAllLink({ href, shown, total, label }: { href: string; shown: number; total: number; label: string }) {
    if (total <= shown) return null;
    return (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-gray-500">
                Showing the latest {shown} of {total}
            </span>
            <Link href={href} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline">
                {label}
                <ChevronRight className="w-4 h-4" />
            </Link>
        </div>
    );
}

/**
 * The frame of an order's "view all" pages: back to the order, the order code
 * and customer, then the full list. Same card look as the order page.
 */
export function OrderSubpage({ order, title, children }: { order: Order; title: string; children: ReactNode }) {
    return (
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="bg-linear-to-br from-pink-100 via-pink-50 to-purple-100 border-b border-gray-200 px-4 py-4 sm:px-8 sm:py-5">
                <Link
                    href={`/orders/${order.code}`}
                    className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-primary"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Back to order {order.code}
                </Link>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900">
                    {title} · Order {order.code}
                </h1>
                <p className="mt-1 text-gray-700">{order.customer.name}</p>
            </div>
            <div className="px-4 py-4 sm:px-8 sm:py-6">{children}</div>
        </div>
    );
}
