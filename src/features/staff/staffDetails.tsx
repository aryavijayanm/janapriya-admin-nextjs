"use client";

import { Briefcase, Hash, Heart, IdCard, Landmark, MapPin, Phone, StickyNote, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StaffHeader } from "@/features/staff/StaffHeader";
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

// The staff profile: the shared header (with Edit / Delete / Disable / View
// Account), then the details. The page loads the record on the server and
// 404s if missing, so this always receives a real staff record.
export default function StaffDetails({ staff, photoUrl }: StaffDetailsProps) {
    return (
        // Same width as the account page, so the shared header doesn't jump between the two.
        <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-md overflow-hidden">
            <StaffHeader staff={staff} photoUrl={photoUrl} current="profile" />

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
            </div>
        </div>
    );
}
