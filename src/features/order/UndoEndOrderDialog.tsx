"use client";

import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { useServerAction } from "@/hooks/useServerAction";
import { undoEndOrderAction } from "@/features/order/order.actions";

// "Undo end" for an order ended by mistake. Only offered while no refund is
// recorded (the server checks too). What it does and doesn't bring back is
// said plainly, so nobody expects the duty to restart by itself.
export function UndoEndOrderDialog({ orderId, code, onClose }: { orderId: number; code: string; onClose: () => void }) {
    const { run, isPending, error } = useServerAction();

    const handleUndo = async () => {
        const result = await run(() => undoEndOrderAction(orderId));
        if (result.ok) onClose();
    };

    return (
        <Modal isOpen onClose={() => !isPending && onClose()} title={`Undo end · order ${code}`} size="sm">
            <div className="space-y-4 text-sm text-gray-700">
                <p>The order becomes active again and contracts go back to their full rate.</p>
                <ul className="list-disc space-y-1 pl-5">
                    <li>The staff duty stays stopped — use <strong>Update duty</strong> if someone continues.</li>
                    <li>A contract removed when ending is not brought back — it is started again when due.</li>
                </ul>
                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose} disabled={isPending}>
                        Cancel
                    </Button>
                    <Button onClick={handleUndo} isLoading={isPending}>
                        Undo end
                    </Button>
                </div>
                {error && <Alert variant="error">{error}</Alert>}
            </div>
        </Modal>
    );
}
