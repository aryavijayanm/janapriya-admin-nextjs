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
import { useServerAction } from "@/hooks/useServerAction";
import { orderSchema } from "@/server/validators/order";
import { REMARKS_MAX_LENGTH } from "@/server/validators/text";
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
    /**
     * New order only: "Restart" of this ended order -- branch, services and
     * remarks start from it (all changeable); the customer stays the same.
     */
    restartFrom?: { code: string; branch: BranchValue; serviceIds: number[]; remarks: string | null } | null;
}

export default function OrderForm({ order, customer: preselected, services, canChooseBranch, restartFrom }: OrderFormProps) {
    const router = useRouter();
    const isEditing = !!order;
    // Editing an order, or restarting one: the customer can't be changed.
    const customerLocked = isEditing || !!restartFrom;
    const start = order ?? restartFrom ?? null;

    const [customer, setCustomer] = useState<CustomerOption | null>(order?.customer ?? preselected ?? null);
    // New order: no branch picked yet, so it can't be saved by forgetting the
    // field ("" fails orderSchema with "Please choose a branch"). OUTSIDER never
    // sees the field and always gets Kerala (the server forces it too).
    const [branch, setBranch] = useState<BranchValue | "">(start?.branch ?? (canChooseBranch ? "" : "KERALA"));
    const [serviceIds, setServiceIds] = useState<number[]>(start?.serviceIds ?? []);
    const [remarks, setRemarks] = useState(start?.remarks ?? "");
    const { run, isPending: isSubmitting, error, setError } = useServerAction();
    const [success, setSuccess] = useState(false);

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

        const result = await run(() =>
            order ? updateOrderAction(order.id, payload) : createOrderAction(payload, restartFrom?.code ?? null),
        );
        if (!result.ok) return; // run() already shows the message
        setSuccess(true);
        // A moment to see the success message, then the order's page.
        redirectTimerRef.current = setTimeout(() => router.push(`/orders/${result.code}`), 1500);
    };

    return (
        // p-4 on phones, p-8 from sm: up -- same look on a laptop.
        <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-6 text-gray-800">
                {isEditing ? `Edit Order · ${order.code}` : restartFrom ? `Restart order ${restartFrom.code}` : "New Order"}
            </h2>
            {restartFrom && (
                <p className="-mt-4 mb-6 text-sm text-gray-600">
                    A new order (with its own code, contracts from #1), linked to {restartFrom.code}. Details are copied
                    from it — change anything that&apos;s different now.
                </p>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <FormField label="Customer" htmlFor="customer">
                    {/* An order never changes customer: when editing or restarting, shown but not changeable. */}
                    <CustomerPicker value={customer} onChange={setCustomer} readOnly={customerLocked} />
                </FormField>

                {canChooseBranch && (
                    <FormField label="Branch" htmlFor="branch">
                        <Select
                            id="branch"
                            value={branch}
                            onChange={(e) => setBranch(e.target.value as BranchValue)}
                            className="md:w-60"
                        >
                            <option value="" disabled>
                                Select branch
                            </option>
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
                        maxLength={REMARKS_MAX_LENGTH}
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
