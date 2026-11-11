"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Search } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { FilterGroup } from "@/components/ui/FilterGroup";
import { Input } from "@/components/ui/Input";
import type { TableColumn } from "@/components/ui/Table";
import { usePagination } from "@/hooks/usePagination";
import { formatRupees } from "@/lib/money";
import type { PaginatedResult } from "@/server/db/paginate";
import type { StaffBalanceRow } from "@/server/services/staff-balance.service";
import {
    BALANCE_DUTY_FILTERS,
    BALANCE_DUTY_LABELS,
    BALANCE_MONEY_FILTERS,
    BALANCE_MONEY_LABELS,
    type StaffBalanceQuery,
} from "@/server/validators/staff-balance";

interface StaffBalancesProps {
    rows: StaffBalanceRow[];
    pagination: PaginatedResult<StaffBalanceRow>["pagination"];
    query: StaffBalanceQuery;
}

// The staff balances look-up: who we owe and who owes us, from the stored
// balance (estimated until yesterday). Read-only -- a click opens the staff
// account, where the real figure is calculated and paid. Filters and search
// live in the URL (bookmarkable; the page re-renders on the server).
export function StaffBalances({ rows, pagination, query }: StaffBalancesProps) {
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

    const columns: TableColumn<StaffBalanceRow>[] = [
        {
            header: "Name",
            accessor: (s) => (
                <span className="font-medium text-gray-900">
                    {s.name}
                    {s.status !== "ACTIVE" && (
                        <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                            {s.status === "DISABLED" ? "Disabled" : "Deleted"}
                        </span>
                    )}
                </span>
            ),
        },
        { header: "Place", accessor: "place" },
        {
            header: "Duty",
            accessor: (s) =>
                s.onDuty ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        On duty
                    </span>
                ) : (
                    <span className="text-gray-500">Not on duty</span>
                ),
        },
        {
            header: "Balance",
            accessor: (s) =>
                s.balanceDue > 0 ? (
                    <span className="tabular-nums">
                        {BALANCE_MONEY_LABELS.owed}: <strong>{formatRupees(s.balanceDue)}</strong>
                    </span>
                ) : (
                    <span className="tabular-nums text-amber-700">
                        {BALANCE_MONEY_LABELS.owes}: <strong>{formatRupees(-s.balanceDue)}</strong>
                    </span>
                ),
        },
    ];

    return (
        <div className="max-w-full mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold text-gray-800">Staff balances</h2>
            <p className="mt-1 mb-6 flex items-start gap-2 text-sm text-gray-600">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                Estimated until yesterday, for a quick look. Open a staff member to see the exact amount and pay.
            </p>

            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="flex flex-wrap gap-6">
                    <FilterGroup
                        label="Money"
                        options={BALANCE_MONEY_FILTERS}
                        labels={BALANCE_MONEY_LABELS}
                        value={query.money}
                        onChange={(v) => setParam("money", v, "all")}
                    />
                    <FilterGroup
                        label="Duty"
                        options={BALANCE_DUTY_FILTERS}
                        labels={BALANCE_DUTY_LABELS}
                        value={query.duty}
                        onChange={(v) => setParam("duty", v, "all")}
                    />
                </div>
                <form
                    className="relative w-full lg:w-72"
                    onSubmit={(e) => {
                        e.preventDefault();
                        setParam("search", search.trim());
                    }}
                >
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <Input
                        aria-label="Search staff"
                        placeholder="Search name, place, phone… (Enter)"
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
                getRowKey={(s) => s.id}
                isLoading={false}
                emptyMessage="No staff with a balance for these filters."
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                onRowClick={(s) => router.push(`/staff/${s.id}/account`)}
            />
        </div>
    );
}
