"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Search } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { FilterGroup } from "@/components/ui/FilterGroup";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type { TableColumn } from "@/components/ui/Table";
import { usePagination } from "@/hooks/usePagination";
import { formatDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import { BRANCH_STYLES } from "@/features/order/orderTable";
import { paymentStatusStyle } from "@/features/order/paymentStatus";
import type { PaginatedResult } from "@/server/db/paginate";
import type { PaymentsContractRow, PaymentsOrderRow } from "@/server/services/payments-list.service";
import { PAYMENT_MODE_LABELS } from "@/server/validators/payment";
import { PAYMENTS_FILTERS, PAYMENTS_FILTER_LABELS, type PaymentsListQuery } from "@/server/validators/payments-list";

interface PaymentsTableProps {
    orders: PaymentsOrderRow[];
    pagination: PaginatedResult<PaymentsOrderRow>["pagination"];
    query: PaymentsListQuery;
    /** False for OUTSIDER: no Branch column or filter (all their rows are Kerala). */
    showBranch: boolean;
    /** Owner: the "Refund to give" filter. */
    showRefunds: boolean;
}

/** One table row = one contract; `first` = the first row of its order (shows who it is). */
interface Row {
    order: PaymentsOrderRow;
    contract: PaymentsContractRow;
    first: boolean;
}

const REFUND_STYLE = "bg-amber-100 text-amber-800";

function Pill({ label, className }: { label: string; className: string }) {
    return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${className}`}>{label}</span>;
}

// The payments table: who still has to pay, and how much. Read-only -- a
// click opens the order, where payments are recorded (one place for money).
// Each order shows only the contracts that matter (see contractsToShow);
// the customer and order appear on its first row. Filters live in the URL.
export function PaymentsTable({ orders, pagination, query, showBranch, showRefunds }: PaymentsTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setPage } = usePagination();
    const [search, setSearch] = useState(query.search ?? "");

    /** Changes one URL parameter and goes back to page 1 (a new filter = a new list). */
    const setParam = (key: string, value: string, defaultValue = "") => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === defaultValue) params.delete(key);
        else params.set(key, value);
        params.delete("page");
        router.push(`?${params.toString()}`);
    };

    const rows: Row[] = orders.flatMap((order) => order.contracts.map((contract, i) => ({ order, contract, first: i === 0 })));
    const filters = PAYMENTS_FILTERS.filter((f) => f !== "REFUND" || showRefunds);

    const columns: TableColumn<Row>[] = [
        {
            header: "Customer",
            accessor: ({ order, first }) => (first ? <span className="font-medium text-gray-900">{order.customer.name}</span> : null),
        },
        {
            header: "Order",
            accessor: ({ order, first }) =>
                first ? (
                    <span className="whitespace-nowrap">
                        <span className="font-mono font-semibold text-gray-800">{order.code}</span>
                        {order.ended && <span className="ml-2 text-xs text-gray-500">Ended</span>}
                    </span>
                ) : null,
        },
        ...(showBranch
            ? [
                  {
                      header: "Branch",
                      accessor: ({ order, first }: Row) => (first ? <Pill {...BRANCH_STYLES[order.branch]} /> : null),
                  },
              ]
            : []),
        { header: "Contract", accessor: ({ contract }) => <span className="font-semibold">#{contract.contractNumber}</span> },
        { header: "Due date", accessor: ({ contract }) => (contract.startDate ? formatDate(contract.startDate) : "—") },
        {
            header: "Rate",
            accessor: ({ contract }) => (
                <span className="tabular-nums">
                    {formatRupees(contract.rate)}
                    {/* After End order: what is charged for the days served. */}
                    {contract.charge !== null && contract.charge !== contract.rate && (
                        <span className="block text-xs text-gray-500">charged {formatRupees(contract.charge)}</span>
                    )}
                </span>
            ),
        },
        { header: "Paid", accessor: ({ contract }) => <span className="tabular-nums">{formatRupees(contract.paidAmount)}</span> },
        {
            header: "Balance",
            accessor: ({ contract }) =>
                contract.balance > 0 ? (
                    <span className="font-semibold tabular-nums text-red-700">{formatRupees(contract.balance)}</span>
                ) : (
                    <span className="tabular-nums text-gray-500">{formatRupees(0)}</span>
                ),
        },
        {
            header: "Status",
            accessor: ({ contract }) =>
                contract.refund > 0 ? (
                    <Pill label={`Refund to give ${formatRupees(contract.refund)}`} className={REFUND_STYLE} />
                ) : (
                    <Pill {...paymentStatusStyle(contract)} />
                ),
        },
        { header: "Paid on", accessor: ({ contract }) => (contract.lastPayment ? formatDate(contract.lastPayment.paidOn) : "—") },
        { header: "How", accessor: ({ contract }) => (contract.lastPayment ? PAYMENT_MODE_LABELS[contract.lastPayment.mode] : "—") },
    ];

    return (
        <div className="max-w-full mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800">Payments</h2>
            <p className="mt-1 mb-6 flex items-start gap-2 text-sm text-gray-600">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                Running orders, and ended orders with money still to pay. Click a row to open the order and record a
                payment there.
            </p>

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap items-end gap-6">
                    <FilterGroup
                        label="Status"
                        options={filters}
                        labels={PAYMENTS_FILTER_LABELS}
                        value={query.status}
                        onChange={(v) => setParam("status", v, "all")}
                    />
                    {showBranch && (
                        <Select
                            aria-label="Filter by branch"
                            value={query.branch ?? ""}
                            onChange={(e) => setParam("branch", e.target.value)}
                            className="md:w-40"
                        >
                            <option value="">All branches</option>
                            <option value="KERALA">Kerala</option>
                            <option value="OUTSIDE">Outside</option>
                        </Select>
                    )}
                </div>
                <form
                    className="relative w-full lg:w-80"
                    onSubmit={(e) => {
                        e.preventDefault();
                        setParam("search", search.trim());
                    }}
                >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                        aria-label="Search payments"
                        placeholder="Order code, customer name, phone, CR-… (Enter)"
                        value={search}
                        maxLength={100}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9"
                    />
                </form>
            </div>

            <DataTable
                columns={columns}
                data={rows}
                getRowKey={({ contract }) => contract.id}
                isLoading={false}
                emptyMessage="No orders for these filters."
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                onRowClick={({ order }) => router.push(`/orders/${order.code}`)}
            />
        </div>
    );
}
