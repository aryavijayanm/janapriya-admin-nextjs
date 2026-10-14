"use client";

import { useState } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { ServiceFormModal } from "@/features/service/ServiceFormModal";
import { setServiceActiveAction } from "@/features/service/service.actions";
import type { Service } from "@prisma/client";

// Same pattern as UserTable: data arrives as props from the Server Component
// page, and each Server Action calls revalidatePath("/services") so fresh
// props arrive after any change. That also replaces the old
// refetchActiveServices() call into ServicesContext -- there is no
// client-side copy of the services list left to keep in sync.
export default function ServiceTable({ services }: { services: Service[] }) {
    const [modalOpen, setModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [togglingId, setTogglingId] = useState<number | null>(null);
    const [error, setError] = useState("");

    const handleToggleActive = async (service: Service) => {
        setTogglingId(service.id);
        setError("");
        try {
            const result = await setServiceActiveAction(service.id, !service.is_active);
            if (!result.ok) setError(result.error);
        } finally {
            setTogglingId(null);
        }
    };

    const handleAdd = () => {
        setEditingService(null);
        setModalOpen(true);
    };

    const handleEdit = (service: Service) => {
        setEditingService(service);
        setModalOpen(true);
    };

    const columns: TableColumn<Service>[] = [
        { header: "Name", accessor: "name" },
        { header: "Abbreviation", accessor: "abbreviation" },
        {
            header: "Status",
            accessor: (service) => (
                <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${service.is_active ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                        }`}
                >
                    {service.is_active ? "Active" : "Inactive"}
                </span>
            ),
        },
        {
            header: "Actions",
            accessor: (service) => (
                <div className="flex gap-2">
                    <Button
                        size="sm"
                        variant={service.is_active ? "disable" : "enable"}
                        onClick={() => handleToggleActive(service)}
                        isLoading={togglingId === service.id}
                    >
                        {service.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(service)}>
                        Edit
                    </Button>
                </div>
            ),
        },
    ];

    return (
        <>
            {/* p-4 on phones, p-8 from sm: up -- same look on a laptop. */}
            <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold mb-6 text-gray-800">Manage Services</h2>

                {error && <Alert variant="error" className="mb-4">{error}</Alert>}

                <Table
                    columns={columns}
                    data={services}
                    getRowKey={(s) => s.id}
                    emptyMessage="No services yet."
                />
                <div className="mt-4">
                    <Button onClick={handleAdd}>+ Add Service</Button>
                </div>
            </div>

            {/* Mounted only while open and keyed per service, so the form starts
                fresh on every open -- same reasoning as UserFormModal. */}
            {modalOpen && (
                <ServiceFormModal
                    key={editingService?.id ?? "new"}
                    service={editingService}
                    onClose={() => setModalOpen(false)}
                />
            )}
        </>
    );
}
