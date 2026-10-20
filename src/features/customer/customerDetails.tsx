"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    CalendarDays,
    Hash,
    IdCard,
    Mail,
    MapPin,
    Pencil,
    Phone,
    Plus,
    Power,
    StickyNote,
    Trash2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { formatDate } from "@/lib/date";
import { setCustomerStatusAction } from "@/features/customer/customer.actions";
import { formatCustomerCode } from "@/server/validators/customer";
import type { Customer } from "@prisma/client";
import type { OrderListItem } from "@/server/services/order.service";
import { CustomerOrders } from "@/features/order/CustomerOrders";

// Icon + label + value -- same building block as the staff details page.
function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | null }) {
    return (
        <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                <p className="text-sm text-gray-900 mt-0.5 wrap-break-word whitespace-pre-line">{value ?? "—"}</p>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
            {children}
        </section>
    );
}

// A small rounded fact in the header ("CR-000042", "Customer since ...").
function FactChip({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">
            <Icon className="w-4 h-4 text-primary" />
            {children}
        </span>
    );
}

const STATUS_STYLES = {
    ACTIVE: { label: "Active", className: "bg-green-100 text-green-700" },
    DISABLED: { label: "Disabled", className: "bg-orange-100 text-orange-700" },
    DELETED: { label: "Deleted", className: "bg-red-100 text-red-600" },
} as const;

// Phone numbers as tap-to-call links (useful when this page is opened on a phone).
function PhoneLink({ number }: { number: string }) {
    return (
        <a
            href={`tel:${number}`}
            className="flex w-fit items-center gap-3 text-lg font-semibold text-gray-800 hover:text-primary transition-colors"
        >
            <Phone className="w-5 h-5 shrink-0 text-primary" />
            {number}
        </a>
    );
}

export default function CustomerDetails({ customer, orders }: { customer: Customer; orders: OrderListItem[] }) {
    const router = useRouter();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [error, setError] = useState("");

    const handleToggleStatus = async () => {
        setIsToggling(true);
        setError("");
        try {
            // The action revalidates this page, so the fresh record arrives as new props.
            const result = await setCustomerStatusAction(
                customer.id,
                customer.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
            );
            if (!result.ok) setError(result.error);
        } finally {
            setIsToggling(false);
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        setError("");
        try {
            // Soft delete -- the row stays, so future orders and payments
            // that reference this customer keep resolving.
            const result = await setCustomerStatusAction(customer.id, "DELETED");
            if (!result.ok) {
                setError(result.error);
                setDeleteModalOpen(false);
                return;
            }
            router.push("/customer");
        } finally {
            setIsDeleting(false);
        }
    };

    const isDeleted = customer.status === "DELETED";
    const status = STATUS_STYLES[customer.status];

    return (
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-md overflow-hidden">
            {/* ===== Header band ===== */}
            <div className="bg-linear-to-br from-pink-100 via-pink-50 to-purple-100 border-b border-gray-200 px-4 py-4 sm:px-8 sm:py-6">
                {/* Left: Back, name, contacts. Right: code + customer since.
                    Side by side from sm: up; on phones the chips drop below. */}
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex-1">
                        <Button variant="ghost" size="sm" onClick={() => router.back()} aria-label="Back" className="mb-2 -ml-2">
                            <ArrowLeft className="w-4 h-4" />
                            Back
                        </Button>

                        <div className="flex flex-wrap items-center gap-3">
                            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 wrap-break-word">
                                {customer.name}
                            </h1>
                            <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${status.className}`}>
                                {status.label}
                            </span>
                        </div>

                        <div className="mt-3 space-y-2">
                            <PhoneLink number={customer.contactNumber1} />
                            {customer.contactNumber2 && <PhoneLink number={customer.contactNumber2} />}
                            {customer.email && (
                                <a
                                    href={`mailto:${customer.email}`}
                                    className="flex w-fit items-center gap-3 text-lg font-semibold text-gray-800 hover:text-primary transition-colors break-all"
                                >
                                    <Mail className="w-5 h-5 shrink-0 text-primary" />
                                    {customer.email}
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2 sm:flex-col sm:items-end sm:shrink-0">
                        <FactChip icon={Hash}>{formatCustomerCode(customer.id)}</FactChip>
                        <FactChip icon={CalendarDays}>Customer since {formatDate(customer.createdAt)}</FactChip>
                    </div>
                </div>
            </div>

            {/* ===== Body ===== */}
            <div className="px-4 py-4 sm:px-8 sm:py-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section title="Identity">
                        <div className="space-y-3">
                            <InfoRow icon={IdCard} label="ID Proof Type" value={customer.idProof} />
                            <InfoRow icon={Hash} label="ID Number" value={customer.idNumber} />
                        </div>
                    </Section>

                    <Section title="Address">
                        <InfoRow icon={MapPin} label="Address" value={customer.address} />
                    </Section>
                </div>

                <Section title="Remarks">
                    <InfoRow icon={StickyNote} label="Remarks" value={customer.remarks} />
                </Section>

                <Section title="Orders">
                    <CustomerOrders orders={orders} />
                    {/* New orders only for active customers (the server checks this too). */}
                    {customer.status === "ACTIVE" && (
                        <Button
                            size="sm"
                            className="mt-3"
                            onClick={() => router.push(`/orders/new?customerId=${customer.id}`)}
                        >
                            <Plus className="w-4 h-4" />
                            New order
                        </Button>
                    )}
                </Section>

                {error && <Alert variant="error">{error}</Alert>}
            </div>

            {/* ===== Actions ===== */}
            <div className="flex flex-wrap gap-3 px-4 py-4 sm:px-8 border-t border-gray-200 bg-gray-50">
                <Button variant="success" onClick={() => router.push(`/customer/${customer.id}/edit`)}>
                    <Pencil className="w-4 h-4" />
                    Edit
                </Button>
                <Button variant="danger" onClick={() => setDeleteModalOpen(true)} disabled={isDeleted}>
                    <Trash2 className="w-4 h-4" />
                    Delete
                </Button>
                <Button
                    variant={customer.status === "ACTIVE" ? "disable" : "enable"}
                    onClick={handleToggleStatus}
                    isLoading={isToggling}
                    disabled={isDeleted}
                >
                    <Power className="w-4 h-4" />
                    {customer.status === "ACTIVE" ? "Disable" : "Enable"}
                </Button>
            </div>

            <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Customer" size="sm">
                <p className="text-sm text-gray-600">
                    Are you sure you want to delete <span className="font-semibold">{customer.name}</span>?
                    This removes them from the customer list.
                </p>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
                        Delete
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
