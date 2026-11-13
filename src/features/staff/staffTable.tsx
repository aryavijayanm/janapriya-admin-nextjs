"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, Pencil } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Alert } from "@/components/ui/Alert";
import type { TableColumn } from "@/components/ui/Table";
import { usePagination } from "@/hooks/usePagination";
import { useSort } from "@/hooks/useSort";
import { calculateAge } from "@/lib/date";
import { setStaffStatusAction } from "@/features/staff/staff.actions";
import { useServerAction } from "@/hooks/useServerAction";
import { FilterGroup } from "@/components/ui/FilterGroup";
import type { StaffListRow } from "@/server/services/staff.service";
import type { PaginatedResult } from "@/server/db/paginate";
import { STAFF_DUTY_FILTERS, STAFF_DUTY_LABELS, type StaffDutyFilter } from "@/server/validators/staff";
import type { Service } from "@prisma/client";

interface StaffTableProps {
    staff: StaffListRow[];
    pagination: PaginatedResult<StaffListRow>["pagination"];
    // Active services only -- the filter checkboxes.
    services: Service[];
}

// The old version fetched its own page of staff in a useEffect, keyed on
// page/sort/filter/search. Now the page (a Server Component) reads those same
// values from the URL and passes the result in. This component only CHANGES
// the URL -- via usePagination, useSort and the filter below -- and Next.js
// re-renders the page on the server with the new data.
export default function StaffTable({ staff, pagination, services }: StaffTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { setPage } = usePagination();
    const { sortBy, sortDir, toggleSort, toggleSortOnOff } = useSort();
    // Tracks which row's enable/disable request is in flight, so only that
    // row's button shows a loading state instead of the whole table.
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const { run, error } = useServerAction();

    // Filter state lives in the URL too (same bookmarkable/back-forward
    // reasoning as page and sort).
    const selectedServiceIds = useMemo(() => {
        const raw = searchParams.get("serviceIds");
        return raw ? raw.split(",").map(Number) : [];
    }, [searchParams]);

    const toggleServiceFilter = (serviceId: number) => {
        const params = new URLSearchParams(searchParams.toString());
        const next = selectedServiceIds.includes(serviceId)
            ? selectedServiceIds.filter((id) => id !== serviceId)
            : [...selectedServiceIds, serviceId];
        if (next.length > 0) {
            params.set("serviceIds", next.join(","));
        } else {
            params.delete("serviceIds");
        }
        // Same reasoning as a sort change -- the old page number doesn't
        // mean anything against a differently-filtered result set.
        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    // Duty filter, also in the URL. Anything else in the URL reads as "all" (same as the server).
    const dutyParam = searchParams.get("duty");
    const duty: StaffDutyFilter = dutyParam === "on" || dutyParam === "off" ? dutyParam : "all";

    const setDutyFilter = (value: StaffDutyFilter) => {
        const params = new URLSearchParams(searchParams.toString());
        if (value === "all") params.delete("duty");
        else params.set("duty", value);
        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    const handleToggleStatus = async (s: StaffListRow) => {
        setTogglingId(s.id);
        await run(() => setStaffStatusAction(s.id, s.status === "ACTIVE" ? "DISABLED" : "ACTIVE")); // a refusal shows as `error`
        setTogglingId(null);
    };

    const columns: TableColumn<StaffListRow>[] = [
        { header: "Name", accessor: "name", sortKey: "name" },
        { header: "Place", accessor: "place" },
        { header: "Contact", accessor: "contactNumber" },
        { header: "Age", accessor: (s) => (s.dob ? `${calculateAge(s.dob)}` : "—"), sortKey: "age" },
        { header: "Rating", accessor: (s) => `${s.rating}/10`, sortKey: "rating" },
        {
            header: "Services",
            accessor: (s) =>
                s.services.length > 0
                    ? s.services.map((link) => link.service.abbreviation).join(", ")
                    : "—",
        },
        {
            header: "Status",
            accessor: (s) => (
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${s.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        }`}
                >
                    {s.status === "ACTIVE" ? "Active" : "Disabled"}
                </span>
            ),
        },
        {
            header: "Duty",
            accessor: (s) =>
                s.onDuty ? (
                    <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                        {STAFF_DUTY_LABELS.on}
                    </span>
                ) : (
                    <span className="text-gray-500">{STAFF_DUTY_LABELS.off}</span>
                ),
        },
        {
            header: "Actions",
            // Office shortcut: clicking this header shows latest registered
            // first, clicking again goes back to normal. Deliberately invisible
            // (no arrows) so nobody else spots who joined most recently.
            sortKey: "recent",
            quietSort: true,
            accessor: (s) => (
                // Row itself navigates to /staff/:id on click -- stop that click
                // from reaching the row for every button in here, so Edit/toggle
                // don't also trigger a navigation on top of their own action.
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/staff/${s.id}`)}
                        aria-label="View"
                    >
                        <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => router.push(`/staff/${s.id}/edit`)}
                        aria-label="Edit"
                    >
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant={s.status === "ACTIVE" ? "disable" : "enable"}
                        onClick={() => handleToggleStatus(s)}
                        isLoading={togglingId === s.id}
                    >
                        {s.status === "ACTIVE" ? "Disable" : "Enable"}
                    </Button>
                </div>
            ),
        },
    ];

    return (
        // p-4 on phones, p-8 from sm: up -- same look on a laptop.
        <div className="max-w-full mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
            {/* Stacked on phones, side by side from lg: up (the old layout). */}
            <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-start lg:justify-between">
                <h2 className="text-2xl font-bold text-gray-800">All Staff</h2>

                {/* Same Duty filter as Staff balances (one shared list + component). */}
                <FilterGroup
                    label="Duty"
                    options={STAFF_DUTY_FILTERS}
                    labels={STAFF_DUTY_LABELS}
                    value={duty}
                    onChange={setDutyFilter}
                />

                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        SERVICE FILTER
                    </p>
                    <div className="flex flex-wrap lg:justify-end gap-4">
                        {services.map((service) => (
                            <Checkbox
                                key={service.id}
                                id={`filter-service-${service.id}`}
                                label={service.abbreviation}
                                checked={selectedServiceIds.includes(service.id)}
                                onChange={() => toggleServiceFilter(service.id)}
                            />
                        ))}
                    </div>
                </div>
            </div>

            {error && <Alert variant="error" className="mb-4">{error}</Alert>}

            <DataTable
                columns={columns}
                data={staff}
                getRowKey={(s) => s.id}
                // Data arrives already loaded with the page, so there's never
                // an initial loading state here.
                isLoading={false}
                emptyMessage="No staff registered yet."
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                onRowClick={(s) => router.push(`/staff/${s.id}`)}
                sortBy={sortBy}
                sortDir={sortDir}
                onSortChange={(key) => (key === "recent" ? toggleSortOnOff(key, "desc") : toggleSort(key))}
            />
        </div>
    );
}
