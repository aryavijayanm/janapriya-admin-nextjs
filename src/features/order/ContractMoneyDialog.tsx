"use client";

import React, { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { RupeesInput } from "@/features/order/dutyFields";
import { startNextContractAction, updateContractMoneyAction } from "@/features/order/order.actions";
import { contractMoneySchema } from "@/server/validators/order";

/** What the dialog saves to: a brand-new next contract, or an existing one. */
export type ContractMoneyTarget =
    | { kind: "next"; orderId: number; nextNumber: number }
    | { kind: "edit"; contractId: number; contractNumber: number };

interface ContractMoneyDialogProps {
    target: ContractMoneyTarget;
    /** Prefilled: the latest contract's money for "next", the contract's own for "edit". */
    initialRate: number;
    initialStaffSalary: number;
    onClose: () => void;
}

// One dialog for both jobs, since both are just "rate + staff salary":
//   next -> starts contract #N (its dates come from duty, so none are asked)
//   edit -> corrects an existing contract's money
export function ContractMoneyDialog({ target, initialRate, initialStaffSalary, onClose }: ContractMoneyDialogProps) {
    const [rate, setRate] = useState(initialRate);
    const [staffSalary, setStaffSalary] = useState(initialStaffSalary);
    const [error, setError] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const isNext = target.kind === "next";
    const title = isNext ? `Start contract #${target.nextNumber}` : `Edit contract #${target.contractNumber}`;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        const payload = { rate, staffSalary };
        const check = contractMoneySchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        setIsSubmitting(true);
        try {
            const result = isNext
                ? await startNextContractAction(target.orderId, payload)
                : await updateContractMoneyAction(target.contractId, payload);
            if (result.ok) onClose();
            else setError(result.error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Modal isOpen onClose={() => !isSubmitting && onClose()} title={title} size="md">
            <form onSubmit={handleSubmit} className="space-y-5">
                {isNext && (
                    <p className="text-sm text-gray-600">
                        It starts the day after the current contract ends. Its dates are worked out from duty, like
                        every contract.
                    </p>
                )}
                <FormField label="Customer rate (per 28 days)" htmlFor="contract-rate">
                    <RupeesInput id="contract-rate" value={rate} onChange={setRate} />
                </FormField>
                <FormField label="Staff salary (per 28 days)" htmlFor="contract-staff-salary">
                    <RupeesInput id="contract-staff-salary" value={staffSalary} onChange={setStaffSalary} />
                </FormField>

                <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button type="submit" isLoading={isSubmitting}>
                        {isNext ? "Start contract" : "Save"}
                    </Button>
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
