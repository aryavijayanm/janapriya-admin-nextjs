"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { Checkbox } from "@/components/ui/Checkbox";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { CustomerPicker } from "@/features/customer/CustomerPicker";
import { createOrderAction, updateOrderAction } from "@/features/order/order.actions";
import { orderSchema } from "@/server/validators/order";
import type { CustomerOption } from "@/server/services/customer.service";
import type { ServiceOption } from "@/server/services/service.service";

type BranchValue = "KERALA" | "OUTSIDE";

/** What the edit form starts from. */
export interface EditableOrder {
    id: number;
    code: string;
    customer: CustomerOption;
    branch: BranchValue;
    serviceIds: number[];
    remarks: string | null;
}

interface OrderFormProps {
    /** Present = editing this order; absent = creating one. */
    order?: EditableOrder;
    /** New order only: a customer chosen before arriving (customer page, Save & create order). */
    customer?: CustomerOption | null;
    /** Active services, plus any this order already has (shown "(disabled)"). */
    services: ServiceOption[];
    /** False for OUTSIDER: the branch field is hidden. */
    canChooseBranch: boolean;
}

export default function OrderForm({ order, customer: preselected, services, canChooseBranch }: OrderFormProps) {
    const router = useRouter();
    const isEditing = !!order;

    const [customer, setCustomer] = useState<CustomerOption | null>(order?.customer ?? preselected ?? null);
    const [branch, setBranch] = useState<BranchValue>(order?.branch ?? "KERALA");
    const [serviceIds, setServiceIds] = useState<number[]>(order?.serviceIds ?? []);
    const [remarks, setRemarks] = useState(order?.remarks ?? "");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // So a navigation triggered elsewhere doesn't leave a stray redirect firing.
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        return () => {
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        };
    }, []);

    const toggleService = (serviceId: number) => {
        setServiceIds((prev) =>
            prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setSuccess(false);

        if (!customer) {
            setError("Please choose a customer.");
            return;
        }

        const payload = { customerId: customer.id, branch, serviceIds, remarks };
        // Same schema the server uses -- instant feedback here, the real check there.
        const check = orderSchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = order ? await updateOrderAction(order.id, payload) : await createOrderAction(payload);
            if (!result.ok) {
                setError(result.error);
                return;
            }
            setSuccess(true);
            // A moment to see the success message, then the order's page.
            redirectTimerRef.current = setTimeout(() => router.push(`/orders/${result.code}`), 1500);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        // p-4 on phones, p-8 from sm: up -- same look on a laptop.
        <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
                {isEditing ? `Edit Order · ${order.code}` : "New Order"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-6">
                <FormField label="Customer" htmlFor="customer">
                    {/* An order never changes customer: when editing, shown but not changeable. */}
                    <CustomerPicker value={customer} onChange={setCustomer} readOnly={isEditing} />
                </FormField>

                {canChooseBranch && (
                    <FormField label="Branch" htmlFor="branch">
                        <Select
                            id="branch"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value as BranchValue)}
                            className="md:w-60"
                        >
                            <option value="KERALA">Kerala</option>
                            <option value="OUTSIDE">Outside</option>
                        </Select>
                    </FormField>
                )}

                <div>
                    <label className="label mb-3 block">Services</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {services.map((service) => (
                            <Checkbox
                                key={service.id}
                                id={`order-service-${service.id}`}
                                // A disabled service only appears when this order
                                // already has it -- shown so saving keeps it.
                                label={service.is_active ? service.name : `${service.name} (disabled)`}
                                checked={serviceIds.includes(service.id)}
                                onChange={() => toggleService(service.id)}
                            />
                        ))}
                    </div>
                </div>

                <FormField label="Remarks" htmlFor="remarks">
                    <TextArea
                        id="remarks"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        rows={3}
                        placeholder="Anything to remember about this order -- patient details, preferences, expected start…"
                    />
                </FormField>

                <div className="pt-2">
                    <Button type="submit" isLoading={isSubmitting} disabled={success}>
                        {isEditing ? "Save Changes" : "Create Order"}
                    </Button>
                </div>

                {/* Feedback right after the button, where the eye already is. */}
                {error && <Alert variant="error">{error}</Alert>}
                {success && (
                    <Alert variant="success">
                        {isEditing ? "Order updated successfully." : "Order created successfully."}
                    </Alert>
                )}
            </form>
        </div>
    );
}
