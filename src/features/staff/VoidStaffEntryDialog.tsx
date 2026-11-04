"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { FormField } from "@/components/ui/FormField";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { formatDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import { useServerAction } from "@/hooks/useServerAction";
import { voidStaffEntryAction } from "@/features/staff/staff.actions";
import { voidStaffEntrySchema } from "@/server/validators/staff-account";

interface VoidStaffEntryDialogProps {
    staffId: number;
    entry: { id: number; amount: number; entryDate: Date; remarks: string };
    onClose: () => void;
}

// Voiding is the only way to correct an entry before the salary is cleared:
// it stays in the passbook, crossed out with who/when/why, and stops counting.
export function VoidStaffEntryDialog({ staffId, entry, onClose }: VoidStaffEntryDialogProps) {
    const [reason, setReason] = useState("");
    const { run, isPending, error, setError } = useServerAction();

    const handleVoid = async () => {
        const check = voidStaffEntrySchema.safeParse({ reason });
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please give a reason.");
            return;
        }
        const result = await run(() => voidStaffEntryAction(staffId, entry.id, { reason }));
        if (result.ok) onClose();
    };

    return (
        <Modal isOpen onClose={() => !isPending && onClose()} title="Void entry" size="sm">
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    Void <span className="font-semibold text-gray-900">{formatRupees(Math.abs(entry.amount))}</span> (
                    {entry.remarks}, {formatDate(entry.entryDate)})? It stays in the passbook, crossed out, and no
                    longer counts.
                </p>
                <FormField label="Reason" htmlFor="void-entry-reason">
                    <Input
                        id="void-entry-reason"
                        maxLength={200}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. entered twice"
                        autoFocus
                    />
                </FormField>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={isPending}>
                        Keep it
                    </Button>
                    <Button variant="danger" onClick={handleVoid} isLoading={isPending}>
                        Void entry
                    </Button>
                </div>
                {error && <Alert variant="error">{error}</Alert>}
            </div>
        </Modal>
    );
}
