"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Modal } from "@/components/ui/Modal";
import { createCustomerAction, updateCustomerAction } from "@/features/customer/customer.actions";
import { customerSchema, formatCustomerCode } from "@/server/validators/customer";
import type { PossibleDuplicate } from "@/server/services/customer.service";
import type { Customer } from "@prisma/client";

const EMPTY_FORM = {
    name: "",
    contactNumber1: "",
    contactNumber2: "",
    email: "",
    idProof: "",
    idNumber: "",
    address: "",
    remarks: "",
};

type FormData = typeof EMPTY_FORM;

// Edit mode: start from the saved customer, nulls shown as empty boxes.
function formFromCustomer(customer: Customer): FormData {
    return {
        name: customer.name,
        contactNumber1: customer.contactNumber1,
        contactNumber2: customer.contactNumber2 ?? "",
        email: customer.email ?? "",
        idProof: customer.idProof ?? "",
        idNumber: customer.idNumber ?? "",
        address: customer.address,
        remarks: customer.remarks ?? "",
    };
}

// While typing a phone number: digits, with an optional "+" only as the first
// character. Anything else is simply ignored. (The saved value must also have
// at least one digit -- the Zod schema checks that on submit.)
const PHONE_WHILE_TYPING = /^\+?\d*$/;

interface CustomerFormProps {
    // Presence means "editing this customer"; absence means "registering a
    // new one" -- one form, two thin modes, same as staffForm.
    customer?: Customer;
}

export default function CustomerForm({ customer }: CustomerFormProps) {
    const router = useRouter();
    const isEditing = !!customer;

    const [form, setForm] = useState<FormData>(customer ? formFromCustomer(customer) : EMPTY_FORM);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Possible duplicates the server found; null = no warning showing.
    const [duplicates, setDuplicates] = useState<PossibleDuplicate[] | null>(null);

    // So a navigation triggered elsewhere doesn't leave a stray redirect
    // firing after this component is gone.
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        };
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if ((name === "contactNumber1" || name === "contactNumber2") && !PHONE_WHILE_TYPING.test(value)) {
            return;
        }
        setForm((prev) => ({ ...prev, [name]: value }));
        // The warning described the details as they WERE; once they change,
        // it no longer applies.
        setDuplicates(null);
    };

    // Where to go after a successful save: the customer's page, or straight to
    // a new order for them ("Save & create order"). Kept in state so that
    // "Save anyway" on the duplicate warning goes where the user first chose.
    const [destination, setDestination] = useState<"customer" | "order">("customer");

    // confirmDuplicate = true is "Save anyway": the server skips the check.
    const save = async (confirmDuplicate: boolean, then: "customer" | "order") => {
        setError("");
        setSuccess(false);
        setDestination(then);

        // Same schema the server uses -- instant feedback here, the real check there.
        const check = customerSchema.safeParse(form);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = customer
                ? await updateCustomerAction(customer.id, form, confirmDuplicate)
                : await createCustomerAction(form, confirmDuplicate);

            if (!result.ok) {
                if ("duplicates" in result) {
                    // Not saved yet -- open the warning and let the user decide.
                    setDuplicates(result.duplicates);
                } else {
                    // Close the warning (if "Save anyway" was what failed), so the
                    // error below the form isn't hidden behind it.
                    setDuplicates(null);
                    setError(result.error);
                }
                return;
            }

            setDuplicates(null);
            setSuccess(true);
            // A moment to see the success message, then the next page.
            redirectTimerRef.current = setTimeout(() => {
                router.push(then === "order" ? `/orders/new?customerId=${result.id}` : `/customer/${result.id}`);
            }, 1500);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void save(false, "customer");
    };

    return (
        // p-4 on phones, p-8 from sm: up -- same look on a laptop.
        <div className="max-w-6xl mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
                {isEditing ? `Edit Customer · ${formatCustomerCode(customer.id)}` : "Enter Customer Details"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <FormField label="Name" htmlFor="name">
                        <Input id="name" name="name" value={form.name} onChange={handleChange} placeholder="Enter customer name" required />
                    </FormField>

                    <FormField label="Contact Number 1" htmlFor="contactNumber1">
                        <Input
                            type="tel"
                            id="contactNumber1"
                            name="contactNumber1"
                            value={form.contactNumber1}
                            onChange={handleChange}
                            placeholder="e.g. +919876543210"
                            required
                        />
                    </FormField>

                    <FormField label="Contact Number 2 (optional)" htmlFor="contactNumber2">
                        <Input
                            type="tel"
                            id="contactNumber2"
                            name="contactNumber2"
                            value={form.contactNumber2}
                            onChange={handleChange}
                            placeholder="Another number, if any"
                        />
                    </FormField>

                    <FormField label="Email (optional)" htmlFor="email">
                        <Input type="email" id="email" name="email" value={form.email} onChange={handleChange} placeholder="name@example.com" />
                    </FormField>

                    <FormField label="ID Proof Type" htmlFor="idProof">
                        <Input id="idProof" name="idProof" value={form.idProof} onChange={handleChange} placeholder="e.g., Aadhar, Voter ID" />
                    </FormField>

                    <FormField label="ID Number" htmlFor="idNumber">
                        <Input id="idNumber" name="idNumber" value={form.idNumber} onChange={handleChange} placeholder="Enter ID number" />
                    </FormField>
                </div>

                <FormField label="Address" htmlFor="address">
                    <TextArea
                        id="address"
                        name="address"
                        value={form.address}
                        onChange={handleChange}
                        rows={3}
                        placeholder="House name, place, post office, district, pincode"
                        required
                    />
                </FormField>

                <FormField label="Remarks" htmlFor="remarks">
                    <TextArea
                        id="remarks"
                        name="remarks"
                        value={form.remarks}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Any additional notes about this customer"
                    />
                </FormField>

                <div className="flex flex-wrap gap-3 pt-4">
                    <Button
                        type="submit"
                        isLoading={isSubmitting && !duplicates && destination === "customer"}
                        disabled={success || isSubmitting}
                    >
                        {isEditing ? "Save Changes" : "Register Customer"}
                    </Button>
                    {/* Edit too: a returning customer often needs details updated before a new order. */}
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void save(false, "order")}
                        isLoading={isSubmitting && !duplicates && destination === "order"}
                        disabled={success || isSubmitting}
                    >
                        {isEditing ? "Save & create order" : "Register & create order"}
                    </Button>
                </div>

                {/* Possible-duplicate warning, as a modal so it can't be missed.
                    Nothing has been saved yet. Closing it (X, clicking outside,
                    Cancel) just returns to the form -- except while "Save anyway"
                    is in progress, when it stays open until the save finishes. */}
                <Modal
                    isOpen={!!duplicates}
                    onClose={() => {
                        if (!isSubmitting) setDuplicates(null);
                    }}
                    title="Possible duplicate customer"
                    size="md"
                >
                    <div className="space-y-4">
                        <p className="flex items-start gap-2 font-semibold text-amber-800">
                            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                            This might be a customer who is already registered. Check before saving.
                        </p>
                        <ul className="space-y-2">
                            {/* "?? []": the list is built even while the modal is
                                closed, when duplicates is null. */}
                            {(duplicates ?? []).map((d) => (
                                <li key={d.id} className="rounded-lg bg-white border border-amber-200 p-3 text-sm">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-mono text-xs text-gray-500">{formatCustomerCode(d.id)}</span>
                                        <span className="font-semibold text-gray-900">{d.name}</span>
                                        {d.phoneMatch && (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">Same phone</span>
                                        )}
                                        {d.addressMatch && (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                                Address {d.addressScore}% similar
                                            </span>
                                        )}
                                        {/* New tab, so this half-filled form isn't lost. */}
                                        <a
                                            href={`/customer/${d.id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                                        >
                                            Open <ExternalLink className="w-3.5 h-3.5" />
                                        </a>
                                    </div>
                                    <p className="mt-1 text-gray-600 wrap-break-word">{d.address}</p>
                                </li>
                            ))}
                        </ul>
                        <div className="flex flex-wrap gap-2">
                            <Button type="button" onClick={() => void save(true, destination)} isLoading={isSubmitting}>
                                Save anyway
                            </Button>
                            <Button type="button" variant="secondary" onClick={() => setDuplicates(null)} disabled={isSubmitting}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                </Modal>

                {/* Error/success feedback right after the submit button -- on a long
                    form, a message at the top would be out of sight after clicking. */}
                {error && <Alert variant="error">{error}</Alert>}
                {success && (
                    <Alert variant="success">
                        {isEditing ? "Customer updated successfully." : "Customer registered successfully."}
                    </Alert>
                )}
            </form>
        </div>
    );
}
