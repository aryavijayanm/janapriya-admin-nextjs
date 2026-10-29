"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/Input";
import { TextArea } from "@/components/ui/TextArea";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { PossibleDuplicatesModal } from "@/components/ui/PossibleDuplicatesModal";
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

                {/* Possible-duplicate warning (shared with the staff form). */}
                <PossibleDuplicatesModal
                    matches={
                        duplicates?.map((d) => ({
                            id: d.id,
                            href: `/customer/${d.id}`,
                            code: formatCustomerCode(d.id),
                            name: d.name,
                            reasons: [
                                ...(d.phoneMatch ? ["Same phone"] : []),
                                ...(d.addressMatch ? [`Address ${d.addressScore}% similar`] : []),
                            ],
                            detail: d.address,
                        })) ?? null
                    }
                    title="Possible duplicate customer"
                    message="This might be a customer who is already registered. Check before saving."
                    confirmLabel="Save anyway"
                    isSubmitting={isSubmitting}
                    onConfirm={() => void save(true, destination)}
                    onCancel={() => setDuplicates(null)}
                />

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
