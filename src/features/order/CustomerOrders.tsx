"use client";

import Link from "next/link";
import { ChevronRight, ClipboardList } from "lucide-react";
import { formatDate } from "@/lib/date";
import type { OrderListItem } from "@/server/services/order.service";
import { BRANCH_STYLES, ORDER_STATUS_STYLES } from "@/features/order/orderTable";

// One customer's orders, as compact rows for the customer page. Each row opens
// the order page. Same badges as the full order list (orderTable).
export function CustomerOrders({ orders }: { orders: OrderListItem[] }) {
    if (orders.length === 0) {
        return (
            <p className="flex items-center gap-2 text-sm text-gray-500">
                <ClipboardList className="w-4 h-4" />
                No orders yet.
            </p>
        );
    }

    return (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
            {orders.map((order) => {
                const status = ORDER_STATUS_STYLES[order.status];
                const branch = BRANCH_STYLES[order.branch];
                const contract = order.currentContract;
                return (
                    <li key={order.id}>
                        <Link
                            href={`/orders/${order.code}`}
                            className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-primary/5 transition-colors"
                        >
                            <div className="min-w-0 space-y-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-mono font-bold text-gray-900">{order.code}</span>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>
                                        {status.label}
                                    </span>
                                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${branch.className}`}>
                                        {branch.label}
                                    </span>
                                    <span className="text-sm text-gray-500">{order.serviceAbbreviations.join(", ")}</span>
                                </div>
                                <p className="text-sm text-gray-600">
                                    {order.currentStaff ?? "No staff now"}
                                    {contract && (
                                        <>
                                            {" · "}Contract #{contract.contractNumber}
                                            {contract.startDate && `: ${formatDate(contract.startDate)}`}
                                            {contract.startDate &&
                                                ` – ${contract.endDate ? formatDate(contract.endDate) : "pending"}`}
                                        </>
                                    )}
                                </p>
                            </div>
                            <ChevronRight className="w-5 h-5 shrink-0 text-gray-400" />
                        </Link>
                    </li>
                );
            })}
        </ul>
    );
}
