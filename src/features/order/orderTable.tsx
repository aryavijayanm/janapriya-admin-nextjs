"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardPlus, Search } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { TableColumn } from "@/components/ui/Table";
import { usePagination } from "@/hooks/usePagination";
import { formatDate } from "@/lib/date";
import { formatCustomerCode } from "@/server/validators/customer";
import type { PaginatedResult } from "@/server/db/paginate";
import type { OrderListItem } from "@/server/services/order.service";

interface OrderTableProps {
    orders: OrderListItem[];
    pagination: PaginatedResult<OrderListItem>["pagination"];
    /** False for OUTSIDER: the OUTSIDE branch option isn't offered. */
    canSeeOutside: boolean;
}

export const ORDER_STATUS_STYLES = {
    WAITING: { label: "Waiting to start", className: "bg-amber-100 text-amber-800" },
    ACTIVE: { label: "Active", className: "bg-green-100 text-green-700" },
    ENDED: { label: "Ended", className: "bg-gray-200 text-gray-600" },
} as const;

export const BRANCH_STYLES = {
    KERALA: { label: "Kerala", className: "bg-purple-100 text-purple-700" },
    OUTSIDE: { label: "Outside", className: "bg-sky-100 text-sky-700" },
} as const;

function Badge({ label, className }: { label: string; className: string }) {
    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${className}`}>
            {label}
        </span>
    );
}

// Same pattern as staffTable/customerTable: the page reads the filters from
// the URL and passes the result in; this component only CHANGES the URL.
export default function OrderTable({ orders, pagination, canSeeOutside }: OrderTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setPage } = usePagination();
    const [search, setSearch] = useState(searchParams.get("search") ?? "");

    // Sets (or clears) one filter in the URL. A different filter means a
    // different result set, so it always goes back to page 1.
    const setFilter = (key: "status" | "branch" | "search", value: string) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value) params.set(key, value);
        else params.delete(key);
        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    const columns: TableColumn<OrderListItem>[] = [
        { header: "Code", accessor: (o) => <span className="font-mono font-semibold text-gray-800">{o.code}</span> },
        {
            header: "Customer",
            accessor: (o) => (
                <span>
                    <span className="font-mono text-xs text-gray-500 mr-2">{formatCustomerCode(o.customer.id)}</span>
                    {o.customer.name}
                </span>
            ),
        },
        { header: "Branch", accessor: (o) => <Badge {...BRANCH_STYLES[o.branch]} /> },
        { header: "Services", accessor: (o) => o.serviceAbbreviations.join(", ") || "—" },
        { header: "Status", accessor: (o) => <Badge {...ORDER_STATUS_STYLES[o.status]} /> },
        { header: "Current staff", accessor: (o) => o.currentStaff ?? "—" },
        {
            header: "Current contract",
            accessor: (o) =>
                o.currentContract ? (
                    <span>
                        <span className="font-semibold">#{o.currentContract.contractNumber}</span>
                        {" · "}
                        {o.currentContract.startDate ? formatDate(o.currentContract.startDate) : "pending"}
                        {" – "}
                        {o.currentContract.endDate ? formatDate(o.currentContract.endDate) : "pending"}
                    </span>
                ) : (
                    "—"
                ),
        },
    ];

    return (
        // p-4 on phones, p-8 from sm: up -- same look on a laptop.
        <div className="max-w-full mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">All Orders</h2>
                <Button onClick={() => router.push("/orders/new")}>
                    <ClipboardPlus className="w-4 h-4" />
                    New Order
                </Button>
            </div>

            {/* Filters -- side by side on a laptop, stacked on a phone. */}
            <div className="flex flex-col gap-3 mb-6 md:flex-row md:items-center">
                <Select
                    aria-label="Filter by status"
                    value={searchParams.get("status") ?? ""}
                    onChange={(e) => setFilter("status", e.target.value)}
                    className="md:w-48"
                >
                    <option value="">All statuses</option>
                    <option value="WAITING">Waiting to start</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ENDED">Ended</option>
                </Select>

                <Select
                    aria-label="Filter by branch"
                    value={searchParams.get("branch") ?? ""}
                    onChange={(e) => setFilter("branch", e.target.value)}
                    className="md:w-40"
                >
                    <option value="">All branches</option>
                    <option value="KERALA">Kerala</option>
                    {canSeeOutside && <option value="OUTSIDE">Outside</option>}
                </Select>

                <div className="relative md:w-80">
                    <input
                        type="text"
                        placeholder="Order code, customer name, phone, CR-…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") setFilter("search", search.trim());
                        }}
                        className="input-field pr-10"
                    />
                    <button
                        type="button"
                        onClick={() => setFilter("search", search.trim())}
                        aria-label="Search orders"
                        className="absolute inset-y-0 right-3 flex items-center"
                    >
                        <Search className="h-5 w-5 text-gray-400" />
                    </button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={orders}
                getRowKey={(o) => o.id}
                // Data arrives already loaded with the page.
                isLoading={false}
                emptyMessage="No orders found."
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                onRowClick={(o) => router.push(`/orders/${o.code}`)}
            />
        </div>
    );
}
