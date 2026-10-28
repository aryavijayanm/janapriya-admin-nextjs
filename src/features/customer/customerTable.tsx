"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, UserPlus } from "lucide-react";
import { DataTable } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import type { TableColumn } from "@/components/ui/Table";
import { usePagination } from "@/hooks/usePagination";
import { useSort } from "@/hooks/useSort";
import { setCustomerStatusAction } from "@/features/customer/customer.actions";
import { formatCustomerCode } from "@/server/validators/customer";
import type { PaginatedResult } from "@/server/db/paginate";
import type { Customer } from "@prisma/client";

interface CustomerTableProps {
    customers: Customer[];
    pagination: PaginatedResult<Customer>["pagination"];
}

// Same pattern as staffTable: the page (a Server Component) reads page/sort/
// search from the URL and passes the result in. This component only CHANGES
// the URL -- via usePagination and useSort -- and Next.js re-renders the page
// on the server with the new data.
export default function CustomerTable({ customers, pagination }: CustomerTableProps) {
    const router = useRouter();
    const { setPage } = usePagination();
    const { sortBy, sortDir, toggleSort } = useSort();
    // Which row's Enable/Disable is in flight, so only that button spins.
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [error, setError] = useState("");

    const handleToggleStatus = async (c: Customer) => {
        setTogglingId(c.id);
        setError("");
        try {
            const result = await setCustomerStatusAction(c.id, c.status === "ACTIVE" ? "DISABLED" : "ACTIVE");
            if (!result.ok) setError(result.error);
        } finally {
            setTogglingId(null);
        }
    };

    const columns: TableColumn<Customer>[] = [
        {
            header: "Code",
            accessor: (c) => <span className="font-mono text-xs text-gray-600">{formatCustomerCode(c.id)}</span>,
            sortKey: "code",
        },
        { header: "Name", accessor: "name", sortKey: "name" },
        { header: "Contact", accessor: "contactNumber1" },
        {
            header: "Address",
            // Long addresses are cut off with "..." so rows stay one line;
            // hovering shows the whole address.
            accessor: (c) => (
                <span className="block max-w-xs truncate" title={c.address}>
                    {c.address}
                </span>
            ),
        },
        {
            header: "Status",
            accessor: (c) => (
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        }`}
                >
                    {c.status === "ACTIVE" ? "Active" : "Disabled"}
                </span>
            ),
        },
        {
            header: "Actions",
            accessor: (c) => (
                // The row itself navigates on click -- stop that click reaching
                // the row, so Edit/toggle don't also trigger a navigation.
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/customer/${c.id}`)} aria-label="View">
                        <Eye className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => router.push(`/customer/${c.id}/edit`)} aria-label="Edit">
                        <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                        size="sm"
                        variant={c.status === "ACTIVE" ? "disable" : "enable"}
                        onClick={() => handleToggleStatus(c)}
                        isLoading={togglingId === c.id}
                    >
                        {c.status === "ACTIVE" ? "Disable" : "Enable"}
                    </Button>
                </div>
            ),
        },
    ];

    return (
        // p-4 on phones, p-8 from sm: up -- same look on a laptop.
        <div className="max-w-full mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800">All Customers</h2>
                <Button onClick={() => router.push("/customer/new")}>
                    <UserPlus className="w-4 h-4" />
                    Add Customer
                </Button>
            </div>

            {error && <Alert variant="error" className="mb-4">{error}</Alert>}

            <DataTable
                columns={columns}
                data={customers}
                getRowKey={(c) => c.id}
                // Data arrives already loaded with the page.
                isLoading={false}
                emptyMessage="No customers registered yet."
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                onPageChange={setPage}
                onRowClick={(c) => router.push(`/customer/${c.id}`)}
                sortBy={sortBy}
                sortDir={sortDir}
                onSortChange={toggleSort}
            />
        </div>
    );
}
