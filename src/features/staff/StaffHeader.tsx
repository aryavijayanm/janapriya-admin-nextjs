"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Cake, MapPin, Pencil, Phone, Power, Star, Trash2, User, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { calculateAge, formatDate } from "@/lib/date";
import { setStaffStatusAction } from "@/features/staff/staff.actions";
import { useServerAction } from "@/hooks/useServerAction";
import type { StaffWithServices } from "@/server/services/staff.service";

interface StaffHeaderProps {
    staff: StaffWithServices;
    photoUrl: string | null;
    /** Which page this sits on: the last button goes to the other one. */
    current: "profile" | "account";
}

// A small rounded fact in the header ("45 years", "8/10"). Icons are pink by
// default; iconClassName overrides that (e.g. the yellow rating star).
function FactChip({
    icon: Icon,
    iconClassName = "text-primary",
    children,
}: {
    icon: LucideIcon;
    iconClassName?: string;
    children: React.ReactNode;
}) {
    return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-gray-200 px-3 py-1 text-sm font-medium text-gray-700 shadow-sm">
            <Icon className={`w-4 h-4 ${iconClassName}`} />
            {children}
        </span>
    );
}

const STATUS_STYLES = {
    ACTIVE: { label: "Active", className: "bg-green-100 text-green-700" },
    DISABLED: { label: "Disabled", className: "bg-orange-100 text-orange-700" },
    DELETED: { label: "Deleted", className: "bg-red-100 text-red-600" },
} as const;

// The staff header, shared by the profile page and the account page: who
// this is (name, status, place, phone, age, rating, photo) and what can be
// done (Edit, Delete, Disable/Enable, and a button to the other page).
// Delete and Disable live here too, so both pages behave exactly the same.
export function StaffHeader({ staff, photoUrl, current }: StaffHeaderProps) {
    const router = useRouter();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    // Two buttons, two separate spinners -> two instances of the same hook.
    const toggle = useServerAction();
    const removal = useServerAction();
    const error = toggle.error || removal.error;

    const handleToggleStatus = async () => {
        // No local state update: the action revalidates the page, so the
        // fresh record arrives as new props from the server.
        await toggle.run(() => setStaffStatusAction(staff.id, staff.status === "ACTIVE" ? "DISABLED" : "ACTIVE"));
    };

    const handleDelete = async () => {
        // Soft delete -- the row stays (see getStaff's comment on why),
        // it just stops showing up in the staff list.
        const result = await removal.run(() => setStaffStatusAction(staff.id, "DELETED"));
        if (!result.ok) {
            setDeleteModalOpen(false); // so the message on the page isn't hidden behind it
            return;
        }
        router.push("/staff");
    };

    const isDeleted = staff.status === "DELETED";
    const status = STATUS_STYLES[staff.status];

    // Initials for the empty photo frame, e.g. "Anil Kumar" -> "AK".
    const initials = staff.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase())
        .join("");

    return (
        <div className="bg-linear-to-br from-pink-100 via-pink-50 to-purple-100 border-b border-gray-200 px-4 py-4 sm:px-8 sm:py-6">
            {/* Text left, photo right -- at every screen size. On phones the
                photo simply shrinks (see its sizes below), so the Back button
                always stays top-left. */}
            <div className="flex items-start justify-between gap-4 sm:gap-6">
                {/* Left: Back, name, place, phone, age/DOB, rating, buttons. */}
                <div className="min-w-0 flex-1">
                    <Button variant="ghost" size="sm" onClick={() => router.back()} aria-label="Back" className="mb-2 -ml-2">
                        <ArrowLeft className="w-4 h-4" />
                        Back
                    </Button>

                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-gray-900 wrap-break-word">
                            {staff.name}
                        </h1>
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${status.className}`}>
                            {status.label}
                        </span>
                    </div>

                    <div className="mt-3 space-y-2">
                        <p className="flex items-center gap-3 text-lg font-semibold text-gray-800">
                            <MapPin className="w-5 h-5 shrink-0 text-primary" />
                            {staff.place}
                        </p>
                        {/* A tel: link -- tapping it on a phone starts a call. */}
                        <a
                            href={`tel:${staff.contactNumber}`}
                            className="flex w-fit items-center gap-3 text-lg font-semibold text-gray-800 hover:text-primary transition-colors"
                        >
                            <Phone className="w-5 h-5 shrink-0 text-primary" />
                            {staff.contactNumber}
                        </a>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {staff.dob && (
                            <FactChip icon={Cake}>
                                {calculateAge(staff.dob)} years
                                <span className="text-gray-400">· {formatDate(staff.dob)}</span>
                            </FactChip>
                        )}
                        <FactChip icon={Star} iconClassName="fill-yellow-400 text-yellow-400">
                            Rating {staff.rating}/10
                        </FactChip>
                    </div>

                    {/* Actions -- under the facts, visible without scrolling on both pages. */}
                    <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="success" size="sm" onClick={() => router.push(`/staff/${staff.id}/edit`)}>
                            <Pencil className="w-4 h-4" />
                            Edit
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => setDeleteModalOpen(true)} disabled={isDeleted}>
                            <Trash2 className="w-4 h-4" />
                            Delete
                        </Button>
                        <Button
                            variant={staff.status === "ACTIVE" ? "disable" : "enable"}
                            size="sm"
                            onClick={handleToggleStatus}
                            isLoading={toggle.isPending}
                            disabled={isDeleted}
                        >
                            <Power className="w-4 h-4" />
                            {staff.status === "ACTIVE" ? "Disable" : "Enable"}
                        </Button>
                        {current === "profile" ? (
                            <Button variant="secondary" size="sm" onClick={() => router.push(`/staff/${staff.id}/account`)}>
                                <Wallet className="w-4 h-4" />
                                View Account
                            </Button>
                        ) : (
                            <Button variant="secondary" size="sm" onClick={() => router.push(`/staff/${staff.id}`)}>
                                <User className="w-4 h-4" />
                                View Profile
                            </Button>
                        )}
                    </div>

                    {error && <Alert variant="error" className="mt-3">{error}</Alert>}
                </div>

                {/* Photo: a portrait rectangle (4:5), like an ID-card photo.
                    Phone photos are usually portrait, so this shape crops the
                    least. object-cover fills the frame without stretching. */}
                {/* 96x120 on phones, 160x200 on tablets, 192x240 on laptops. */}
                <div className="relative w-24 h-30 sm:w-40 sm:h-50 md:w-48 md:h-60 shrink-0 overflow-hidden rounded-2xl bg-primary/10 ring-4 ring-white shadow-lg">
                    {photoUrl ? (
                        // unoptimized: the browser loads the photo itself, with its
                        // session cookie. Next's image optimizer would fetch it from
                        // the server WITHOUT that cookie and be refused.
                        <Image src={photoUrl} alt={staff.name} fill unoptimized className="object-cover" />
                    ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-primary">
                            <span className="text-3xl sm:text-5xl font-bold">{initials}</span>
                            <span className="text-xs font-medium text-primary/70">No photo</span>
                        </div>
                    )}
                </div>
            </div>

            <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} title="Delete Staff" size="sm">
                <p className="text-sm text-gray-600">
                    Are you sure you want to delete <span className="font-semibold">{staff.name}</span>? This removes
                    them from the staff list.
                </p>
                <div className="flex justify-end gap-2 mt-6">
                    <Button variant="secondary" onClick={() => setDeleteModalOpen(false)}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={handleDelete} isLoading={removal.isPending}>
                        Delete
                    </Button>
                </div>
            </Modal>
        </div>
    );
}
