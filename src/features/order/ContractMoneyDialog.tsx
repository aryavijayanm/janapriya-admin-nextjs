"use client";

import React, { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { RupeesInput } from "@/features/order/dutyFields";
import {
    confirmContractRateAction,
    startNextContractAction,
    updateContractMoneyAction,
} from "@/features/order/order.actions";
import { contractMoneySchema } from "@/server/validators/order";
import { useServerAction } from "@/hooks/useServerAction";

/** What the dialog saves to: a brand-new next contract, or an existing one. */
export type ContractMoneyTarget =
    | { kind: "next"; orderId: number; nextNumber: number }
    | { kind: "edit"; contractId: number; contractNumber: number };

interface ContractMoneyDialogProps {
    target: ContractMoneyTarget;
    /** Prefilled: the latest contract's money for "next", the contract's own for "edit". */
    initialRate: number;
    initialStaffSalary: number;
    /** Auto-started and nobody has confirmed the copied rate yet. */
    needsRateCheck?: boolean;
    onClose: () => void;
}

// One dialog for both jobs, since both are just "rate + staff salary":
//   next -> starts contract #N (its dates come from duty, so none are asked)
//   edit -> corrects an existing contract's money
// For an auto-started contract whose rate nobody has checked yet, it also
// offers "Rate is correct" (nothing to change). Saving changed money counts
// as checked too -- the server records who and when either way.
export function ContractMoneyDialog({
    target,
    initialRate,
    initialStaffSalary,
    needsRateCheck = false,
    onClose,
}: ContractMoneyDialogProps) {
    const [rate, setRate] = useState(initialRate);
    const [staffSalary, setStaffSalary] = useState(initialStaffSalary);
    const { run, isPending: isSubmitting, error, setError } = useServerAction();

    const isNext = target.kind === "next";
    const title = isNext ? `Start contract #${target.nextNumber}` : `Edit contract #${target.contractNumber}`;

    // Every button here ends the same way: save, then close on success.
    const save = async (call: () => ReturnType<typeof updateContractMoneyAction>) => {
        const result = await run(call);
        if (result.ok) onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const payload = { rate, staffSalary };
        const check = contractMoneySchema.safeParse(payload);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the form.");
            return;
        }

        await save(() =>
            target.kind === "next"
                ? startNextContractAction(target.orderId, payload)
                : updateContractMoneyAction(target.contractId, payload),
        );
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
                {needsRateCheck && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        This contract was started automatically with the previous contract&apos;s money. Check it
                        is still right.
                    </p>
                )}
                <FormField label="Customer rate (per 28 days)" htmlFor="contract-rate">
                    <RupeesInput id="contract-rate" value={rate} onChange={setRate} />
                </FormField>
                <FormField label="Staff salary (per 28 days)" htmlFor="contract-staff-salary">
                    <RupeesInput id="contract-staff-salary" value={staffSalary} onChange={setStaffSalary} />
                </FormField>

                <div className="flex flex-wrap justify-end gap-2 pt-2">
                    <Button type="button" variant="secondary" onClick={onClose} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    {needsRateCheck && target.kind === "edit" && (
                        <Button
                            type="button"
                            variant="success"
                            disabled={isSubmitting}
                            onClick={() => void save(() => confirmContractRateAction(target.contractId))}
                        >
                            <CheckCircle2 className="w-4 h-4" />
                            Rate is correct
                        </Button>
                    )}
                    <Button type="submit" isLoading={isSubmitting}>
                        {isNext ? "Start contract" : "Save"}
                    </Button>
                </div>

                {error && <Alert variant="error">{error}</Alert>}
            </form>
        </Modal>
    );
}
