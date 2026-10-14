"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
    ArrowLeft,
    Briefcase,
    Cake,
    Hash,
    Heart,
    IdCard,
    Landmark,
    MapPin,
    Pencil,
    Phone,
    Power,
    StickyNote,
    Star,
    Trash2,
    User,
    Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Alert } from "@/components/ui/Alert";
import { calculateAge, formatDate } from "@/lib/date";
import { setStaffStatusAction } from "@/features/staff/staff.actions";
import type { StaffWithServices } from "@/server/services/staff.service";

interface StaffDetailsProps {
    staff: StaffWithServices;
    photoUrl: string | null;
}

// Icon + label + value, stacked -- the small building block every section
// below is made of, so a reader can scan by icon shape as much as by label.
function InfoRow({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string | number | null }) {
    return (
        <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5 flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary">
                <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
                {/* wrap-break-word: long addresses / account details wrap instead of overflowing */}
                <p className="text-sm text-gray-900 mt-0.5 wrap-break-word whitespace-pre-line">{value ?? "—"}</p>
            </div>
        </div>
    );
}

// A titled, visually separated block. White cards on the page's white body,
// set apart by a hairline border and a soft shadow rather than a grey fill.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">{title}</h3>
            {children}
        </section>
    );
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

// The old version fetched the staff member itself (useEffect + spinner +
// "not found" state). The page now does that on the server and 404s if
// missing, so this component always receives a real staff record.
export default function StaffDetails({ staff, photoUrl }: StaffDetailsProps) {
    const router = useRouter();
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [error, setError] = useState("");

    const handleToggleStatus = async () => {
        setIsToggling(true);
        setError("");
        try {
            // No local setStaff(updated) as before: the action revalidates this
            // page, so the fresh record arrives as new props from the server.
            const result = await setStaffStatusAction(
                staff.id,
                staff.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
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
            // Soft delete -- the row stays (see getStaff's comment on why),
            // it just stops showing up in the staff list.
            const result = await setStaffStatusAction(staff.id, "DELETED");
            if (!result.ok) {
                setError(result.error);
                setDeleteModalOpen(false);
                return;
            }
            router.push("/staff");
        } finally {
            setIsDeleting(false);
        }
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
        <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow-md overflow-hidden">
            {/* ===== Header band: identity on the left, photo on the right ===== */}
            <div className="bg-linear-to-br from-pink-100 via-pink-50 to-purple-100 border-b border-gray-200 px-4 py-4 sm:px-8 sm:py-6">
                {/* Text left, photo right -- at every screen size. On phones the
                    photo simply shrinks (see its sizes below), so the Back
                    button always stays top-left. */}
                <div className="flex items-start justify-between gap-4 sm:gap-6">
                    {/* Left: Back, name, place, phone, age/DOB, rating. The Back
                        button lives inside this column, so the photo on the
                        right starts level with it instead of a row lower. */}
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
                    </div>

                    {/* Photo: a portrait rectangle (4:5), like an ID-card photo.
                        Phone photos are usually portrait, so this shape crops
                        the least. object-cover fills the frame without stretching. */}
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
            </div>

            {/* ===== Body ===== */}
            <div className="px-4 py-4 sm:px-8 sm:py-6 space-y-4">
                {/* Row 1 -- services as chips, first: what this person can do
                    is the most-asked question when assigning duties. */}
                <Section title="Services Offered">
                    {staff.services.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {staff.services.map((link) => (
                                <span
                                    key={link.serviceId}
                                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${link.service.is_active
                                        ? "bg-primary/10 text-primary"
                                        : "bg-gray-100 text-gray-500"
                                        }`}
                                >
                                    <Briefcase className="w-3.5 h-3.5" />
                                    {link.service.name}
                                    {!link.service.is_active && " (disabled)"}
                                </span>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500">No services assigned.</p>
                    )}
                </Section>

                {/* Row 2 -- two columns */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Section title="Guardian">
                        <div className="space-y-3">
                            <InfoRow icon={User} label="Guardian Name" value={staff.guardianName} />
                            <InfoRow icon={Heart} label="Relationship" value={staff.relationshipWithGuardian} />
                            <InfoRow icon={Phone} label="Guardian Contact" value={staff.guardianContactNumber} />
                        </div>
                    </Section>

                    <Section title="Identity">
                        <div className="space-y-3">
                            <InfoRow icon={IdCard} label="ID Proof Type" value={staff.idProof} />
                            <InfoRow icon={Hash} label="ID Number" value={staff.idNumber} />
                        </div>
                    </Section>
                </div>

                {/* Row 3 -- longer free-text fields, grouped together */}
                <Section title="Other Details">
                    <div className="space-y-4">
                        <InfoRow icon={MapPin} label="Verified Address" value={staff.verifiedAddress} />
                        <InfoRow icon={Landmark} label="Given Accounts" value={staff.bankAccountDetails} />
                        <InfoRow icon={StickyNote} label="Remarks" value={staff.remarks} />
                    </div>
                </Section>

                {error && <Alert variant="error">{error}</Alert>}
            </div>

            {/* ===== Actions -- bottom of the page, not the header ===== */}
            <div className="flex flex-wrap gap-3 px-4 py-4 sm:px-8 border-t border-gray-200 bg-gray-50">
                <Button variant="success" onClick={() => router.push(`/staff/${staff.id}/edit`)}>
                    <Pencil className="w-4 h-4" />
                    Edit
                </Button>
                <Button
                    variant="danger"
                    onClick={() => setDeleteModalOpen(true)}
                    disabled={isDeleted}
                >
                    <Trash2 className="w-4 h-4" />
                    Delete
                </Button>
                <Button
                    variant={staff.status === "ACTIVE" ? "disable" : "enable"}
                    onClick={handleToggleStatus}
                    isLoading={isToggling}
                    disabled={isDeleted}
                >
                    <Power className="w-4 h-4" />
                    {staff.status === "ACTIVE" ? "Disable" : "Enable"}
                </Button>
                <Button variant="secondary" disabled title="Coming soon">
                    <Wallet className="w-4 h-4" />
                    View Account
                </Button>
            </div>

            <Modal
                isOpen={deleteModalOpen}
                onClose={() => setDeleteModalOpen(false)}
                title="Delete Staff"
                size="sm"
            >
                <p className="text-sm text-gray-600">
                    Are you sure you want to delete <span className="font-semibold">{staff.name}</span>?
                    This removes them from the staff list.
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
