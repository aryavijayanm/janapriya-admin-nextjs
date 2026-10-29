"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera, Star, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { toDateInputValue } from "@/lib/date";
import { createStaffAction, updateStaffAction } from "@/features/staff/staff.actions";
import { STAFF_PHOTO_MAX_BYTES, STAFF_PHOTO_TYPES, staffSchema } from "@/server/validators/staff";
import { PossibleDuplicatesModal } from "@/components/ui/PossibleDuplicatesModal";
import type { PossibleDuplicateStaff, StaffWithServices } from "@/server/services/staff.service";
import type { ServiceOption } from "@/server/services/service.service";

const INITIAL_FORM_DATA = {
    name: "",
    place: "",
    contactNumber: "",
    dob: "",
    guardianName: "",
    relationshipWithGuardian: "",
    guardianContactNumber: "",
    verifiedAddress: "",
    idProof: "",
    idNumber: "",
    bankAccountDetails: "",
    // Stores service IDs, not names -- matches the StaffService join
    // table design (staffId + serviceId), and stays correct even if a
    // service is renamed later.
    services: [] as number[],
    rating: 5,
    remarks: "",
};

// Builds the form's initial state from an existing staff record -- used
// only in edit mode. Reverses the transform create applies: the "+91"
// prefix is stripped back off contactNumber (the fixed prefix is shown
// separately and re-added by the server), and dob goes through the same
// Kerala-timezone-aware formatter as everywhere else dates are displayed.
function formDataFromStaff(staff: StaffWithServices): typeof INITIAL_FORM_DATA {
    return {
        name: staff.name,
        place: staff.place,
        contactNumber: staff.contactNumber.replace(/^\+91/, ""),
        dob: staff.dob ? toDateInputValue(staff.dob) : "",
        guardianName: staff.guardianName ?? "",
        relationshipWithGuardian: staff.relationshipWithGuardian ?? "",
        guardianContactNumber: staff.guardianContactNumber ?? "",
        verifiedAddress: staff.verifiedAddress ?? "",
        idProof: staff.idProof ?? "",
        idNumber: staff.idNumber ?? "",
        bankAccountDetails: staff.bankAccountDetails ?? "",
        services: staff.services.map((link) => link.serviceId),
        rating: staff.rating,
        remarks: staff.remarks ?? "",
    };
}

const ratingLabels: { [key: number]: string } = {
    1: "Terrible",
    2: "Very Bad",
    3: "Bad",
    4: "Below Average",
    5: "Average",
    6: "Above Average",
    7: "Good",
    8: "Very Good",
    9: "Excellent",
    10: "Outstanding",
};

interface StaffFormProps {
    // Presence means "editing this staff member"; absence means "registering
    // a new one" -- one form, two thin modes, same as ServiceFormModal.
    staff?: StaffWithServices;
    // Active services, plus (when editing) any disabled ones this person is
    // still linked to -- see the edit page.
    services: ServiceOption[];
    // The current photo's URL when editing, if there is one.
    photoUrl?: string | null;
}

export default function StaffForm({ staff, services, photoUrl }: StaffFormProps) {
    const router = useRouter();
    const isEditing = !!staff;

    const [formData, setFormData] = useState(
        staff ? formDataFromStaff(staff) : INITIAL_FORM_DATA,
    );
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Possible duplicates the server found; null = no warning showing.
    const [duplicates, setDuplicates] = useState<PossibleDuplicateStaff[] | null>(null);

    // --- Photo state ---
    // photoFile: a newly chosen file, not yet uploaded.
    // previewUrl: a temporary browser-only address for that file, so it can be
    //   shown before uploading (URL.createObjectURL). It must be released with
    //   revokeObjectURL when replaced or when leaving the page, or the browser
    //   keeps the image in memory.
    // removePhoto: editing only -- the existing photo should be deleted.
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [removePhoto, setRemovePhoto] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const previewUrlRef = useRef<string | null>(null);

    // So a navigation triggered elsewhere (e.g. the user clicking away)
    // doesn't leave a stray redirect firing after this component is gone.
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        };
    }, []);

    // What the photo circle shows: a new pick wins, then the existing photo
    // (unless marked for removal), else nothing (initials placeholder).
    const shownPhoto = previewUrl ?? (!removePhoto ? photoUrl ?? null : null);

    const handlePhotoChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        // Clear the input, so picking the same file again still fires onChange.
        e.target.value = "";
        if (!file) return;

        // Checked here for instant feedback; the server checks again, and also
        // proves the file really is an image by decoding it.
        if (!(STAFF_PHOTO_TYPES as readonly string[]).includes(file.type)) {
            setError("Photo must be a JPEG, PNG or WebP image.");
            return;
        }
        if (file.size > STAFF_PHOTO_MAX_BYTES) {
            setError(`Photo must be under ${STAFF_PHOTO_MAX_BYTES / (1024 * 1024)} MB.`);
            return;
        }

        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        const url = URL.createObjectURL(file);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setPhotoFile(file);
        setRemovePhoto(false);
        setError("");
    };

    const handleRemovePhoto = () => {
        if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
        setPreviewUrl(null);
        setPhotoFile(null);
        // Only meaningful if there's a saved photo to delete.
        setRemovePhoto(!!photoUrl);
    };

    const handleChange = (
        e: React.ChangeEvent<
            HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >
    ) => {
        const { name, value } = e.target;

        if (name === "contactNumber" || name === "guardianContactNumber") {
            // Digits only, any length -- non-digit keystrokes are simply
            // ignored. (For contactNumber, the +91 prefix is shown separately
            // and added by the server.)
            if (value === "" || /^\d+$/.test(value)) {
                setFormData((prev) => ({ ...prev, [name]: value }));
            }
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleCheckboxChange = (serviceId: number) => {
        setFormData((prev) => {
            const selected = prev.services.includes(serviceId)
                ? prev.services.filter((id) => id !== serviceId)
                : [...prev.services, serviceId];
            return { ...prev, services: selected };
        });
    };

    // confirmDuplicate = true is "Continue anyway": the server skips the check.
    const save = async (confirmDuplicate: boolean) => {
        setError("");
        setSuccess(false);

        const data = {
            name: formData.name,
            place: formData.place,
            contactNumber: formData.contactNumber,
            dob: formData.dob,
            guardianName: formData.guardianName,
            relationshipWithGuardian: formData.relationshipWithGuardian,
            guardianContactNumber: formData.guardianContactNumber,
            verifiedAddress: formData.verifiedAddress,
            idProof: formData.idProof,
            idNumber: formData.idNumber,
            bankAccountDetails: formData.bankAccountDetails,
            rating: formData.rating,
            remarks: formData.remarks,
            serviceIds: formData.services,
        };

        // The same schema the server validates with -- instant feedback here,
        // the real check there.
        const check = staffSchema.safeParse(data);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        // A file can't travel inside a plain object, so everything goes as
        // FormData: the text fields as one JSON string, the photo as a file.
        const body = new FormData();
        body.set("data", JSON.stringify(data));
        if (photoFile) body.set("photo", photoFile);
        if (removePhoto) body.set("removePhoto", "true");
        if (confirmDuplicate) body.set("confirmDuplicate", "true");

        setIsSubmitting(true);
        try {
            const result = staff
                ? await updateStaffAction(staff.id, body)
                : await createStaffAction(body);

            if (!result.ok) {
                if ("duplicates" in result) {
                    // Not saved yet -- open the warning and let the user decide.
                    setDuplicates(result.duplicates);
                } else {
                    // Close the warning (if "Continue anyway" was what failed),
                    // so the error below the form isn't hidden behind it.
                    setDuplicates(null);
                    setError(result.error);
                }
                return;
            }
            setDuplicates(null);
            setSuccess(true);
            // Give the user a moment to see the success message before
            // leaving -- then land on that staff member's details page,
            // whether this was a create or an edit.
            redirectTimerRef.current = setTimeout(() => {
                router.push(`/staff/${result.id}`);
            }, 1500);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void save(false);
    };

    // Initials for the empty photo circle, e.g. "Anil Kumar" -> "AK".
    const initials = formData.name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase())
        .join("");

    return (
        // p-4 on phones, p-8 from sm: up -- same look on a laptop.
        <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
                {isEditing ? "Edit Staff Details" : "Enter Staff Details"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Photo -- optional */}
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="relative w-24 h-24 shrink-0 rounded-full overflow-hidden bg-primary/10 text-primary flex items-center justify-center text-2xl font-bold">
                        {shownPhoto ? (
                            // unoptimized: the browser loads the photo itself, with
                            // its session cookie. Next's image optimizer would fetch
                            // it from the server WITHOUT that cookie and be refused.
                            <Image src={shownPhoto} alt="Staff photo" fill unoptimized className="object-cover" />
                        ) : (
                            initials || <Camera className="w-8 h-8" />
                        )}
                    </div>
                    <div className="space-y-2">
                        <p className="label">Photo <span className="font-normal text-gray-400">(optional)</span></p>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                                <Camera className="w-4 h-4" />
                                {shownPhoto ? "Change photo" : "Choose photo"}
                            </Button>
                            {shownPhoto && (
                                <Button type="button" variant="ghost" size="sm" onClick={handleRemovePhoto}>
                                    <Trash2 className="w-4 h-4" />
                                    Remove
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-gray-500">
                            JPEG, PNG or WebP, up to {STAFF_PHOTO_MAX_BYTES / (1024 * 1024)} MB.
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={STAFF_PHOTO_TYPES.join(",")}
                            onChange={handlePhotoChosen}
                            className="hidden"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Name */}
                    <FormField label="Name" htmlFor="name">
                        <Input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            placeholder="Enter staff name"
                            required
                        />
                    </FormField>

                    {/* Place */}
                    <FormField label="Place" htmlFor="place">
                        <Input
                            type="text"
                            id="place"
                            name="place"
                            value={formData.place}
                            onChange={handleChange}
                            placeholder="Enter place"
                            required
                        />
                    </FormField>

                    {/* Contact Number */}
                    <FormField label="Contact Number" htmlFor="contactNumber">
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500 text-sm pointer-events-none">
                                +91
                            </span>
                            <Input
                                type="tel"
                                id="contactNumber"
                                name="contactNumber"
                                value={formData.contactNumber}
                                onChange={handleChange}
                                placeholder="Enter contact number"
                                required
                                className="pl-12"
                            />
                        </div>
                    </FormField>

                    {/* DOB */}
                    <FormField label="Date of Birth" htmlFor="dob">
                        <Input
                            type="date"
                            id="dob"
                            name="dob"
                            value={formData.dob}
                            onChange={handleChange}
                        />
                    </FormField>

                    {/* Guardian Name */}
                    <FormField label="Guardian Name" htmlFor="guardianName">
                        <Input
                            type="text"
                            id="guardianName"
                            name="guardianName"
                            value={formData.guardianName}
                            onChange={handleChange}
                            placeholder="Enter guardian name"
                        />
                    </FormField>

                    {/* Relationship with Guardian */}
                    <FormField label="Relationship with Guardian" htmlFor="relationshipWithGuardian">
                        <Input
                            type="text"
                            id="relationshipWithGuardian"
                            name="relationshipWithGuardian"
                            value={formData.relationshipWithGuardian}
                            onChange={handleChange}
                            placeholder="e.g., Father, Husband, Friend, Sister"
                        />
                    </FormField>

                    {/* Guardian Contact Number */}
                    <FormField label="Guardian Contact Number" htmlFor="guardianContactNumber">
                        <Input
                            type="tel"
                            id="guardianContactNumber"
                            name="guardianContactNumber"
                            value={formData.guardianContactNumber}
                            onChange={handleChange}
                            placeholder="Enter guardian contact number"
                        />
                    </FormField>

                    {/* ID Proof */}
                    <FormField label="ID Proof Type" htmlFor="idProof">
                        <Input
                            type="text"
                            id="idProof"
                            name="idProof"
                            value={formData.idProof}
                            onChange={handleChange}
                            placeholder="e.g., Aadhar, Voter ID"
                        />
                    </FormField>

                    {/* ID Number */}
                    <FormField label="ID Number" htmlFor="idNumber">
                        <Input
                            type="text"
                            id="idNumber"
                            name="idNumber"
                            value={formData.idNumber}
                            onChange={handleChange}
                            placeholder="Enter ID number"
                        />
                    </FormField>
                </div>

                {/* Services */}
                <div>
                    <label className="label mb-3 block">Services Can Provide</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {services.map((service) => (
                            <Checkbox
                                key={service.id}
                                id={`service-${service.id}`}
                                // A disabled service only appears here when this
                                // person is already linked to it. It's shown, and
                                // labelled, so saving keeps the link -- untick it to
                                // remove it on purpose.
                                label={service.is_active ? service.name : `${service.name} (disabled)`}
                                checked={formData.services.includes(service.id)}
                                onChange={() => handleCheckboxChange(service.id)}
                            />
                        ))}
                    </div>
                </div>

                {/* Verified Address */}
                <FormField label="Verified Address" htmlFor="verifiedAddress">
                    <TextArea
                        id="verifiedAddress"
                        name="verifiedAddress"
                        value={formData.verifiedAddress}
                        onChange={handleChange}
                        rows={3}
                        placeholder="Enter verified permanent address- check with ID proof"
                        required
                    />
                </FormField>

                {/* Rating -- kept inline as-is, no existing primitive covers this yet */}
                <div>
                    <label className="label mb-3 block">Staff Rating</label>
                    <div className="flex flex-col space-y-2">
                        <div className="flex flex-wrap gap-4">
                            {[...Array(10)].map((_, index) => {
                                const starValue = index + 1;
                                return (
                                    <div
                                        key={starValue}
                                        className="flex flex-col items-center cursor-pointer group"
                                        onClick={() =>
                                            setFormData((prev) => ({ ...prev, rating: starValue }))
                                        }
                                    >
                                        <Star
                                            className={`w-8 h-8 transition-colors duration-200 ${starValue <= formData.rating
                                                ? "fill-yellow-400 text-yellow-400"
                                                : "text-gray-300 group-hover:text-yellow-200"
                                                }`}
                                        />
                                        <span className="text-[10px] text-gray-500 mt-1 font-medium">
                                            {ratingLabels[starValue]}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                        <p className="text-sm text-gray-500 mt-2">
                            Selected Rating:{" "}
                            <span className="font-semibold text-gray-800">
                                {formData.rating > 0 ? `${formData.rating}/10` : "Not rated"}
                            </span>
                        </p>
                    </div>
                </div>

                {/* Given Accounts */}
                <FormField label="Given Accounts" htmlFor="bankAccountDetails">
                    <TextArea
                        id="bankAccountDetails"
                        name="bankAccountDetails"
                        value={formData.bankAccountDetails}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Bank account details to pay their salary."
                    />
                </FormField>

                {/* Remarks */}
                <FormField label="Remarks" htmlFor="remarks">
                    <TextArea
                        id="remarks"
                        name="remarks"
                        value={formData.remarks}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Any additional remarks - Include family details and their name, job, relatives, etc."
                    />
                </FormField>

                {/* Submit Button */}
                <div className="pt-4">
                    <Button type="submit" isLoading={isSubmitting && !duplicates} disabled={success}>
                        {isEditing ? "Save Changes" : "Register Staff"}
                    </Button>
                </div>

                {/* Possible-duplicate warning (shared with the customer form). */}
                <PossibleDuplicatesModal
                    matches={
                        duplicates?.map((d) => ({
                            id: d.id,
                            href: `/staff/${d.id}`,
                            name: d.name,
                            reasons: [
                                ...(d.phoneMatch ? ["Same phone"] : []),
                                ...(d.idMatch ? ["Same ID number"] : []),
                                ...(d.addressMatch ? [`Address ${d.addressScore}% similar`] : []),
                            ],
                            detail: [d.place, d.address].filter(Boolean).join(" · "),
                        })) ?? null
                    }
                    title="Possible duplicate staff"
                    message="This staff member might already be registered. Check before saving."
                    confirmLabel="Continue anyway"
                    isSubmitting={isSubmitting}
                    onConfirm={() => void save(true)}
                    onCancel={() => setDuplicates(null)}
                />

                {/* Error/success feedback goes right after the submit button --
                    on a long form, placing it at the top means the user can't
                    see it without scrolling back up after clicking submit. */}
                {error && <Alert variant="error">{error}</Alert>}
                {success && (
                    <Alert variant="success">
                        {isEditing ? "Staff updated successfully." : "Staff registered successfully."}
                    </Alert>
                )}
            </form>
        </div>
    );
}
