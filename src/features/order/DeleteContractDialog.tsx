"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { deleteContractAction } from "@/features/order/order.actions";
import { useServerAction } from "@/hooks/useServerAction";

interface DeleteContractDialogProps {
    contractId: number;
    contractNumber: number;
    onClose: () => void;
}

// "Are you sure?" for removing a contract started by mistake. The order page
// only offers it for the latest contract (not #1) with 0 served days; the
// server checks the same rules again before deleting.
export function DeleteContractDialog({ contractId, contractNumber, onClose }: DeleteContractDialogProps) {
    const { run, isPending: isDeleting, error } = useServerAction();

    const handleDelete = async () => {
        const result = await run(() => deleteContractAction(contractId));
        if (result.ok) onClose();
    };

    return (
        <Modal isOpen onClose={() => !isDeleting && onClose()} title={`Delete contract #${contractNumber}`} size="sm">
            <div className="space-y-4">
                <p className="text-sm text-gray-600">
                    Contract #{contractNumber} has no served days yet. Delete it? Use this only if it was started
                    by mistake.
                </p>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={isDeleting}>
                        Keep it
                    </Button>
                    <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
                        Delete
                    </Button>
                </div>
                {error && <Alert variant="error">{error}</Alert>}
            </div>
        </Modal>
    );
}
