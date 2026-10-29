"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/** One look-alike record, already turned into display text by the form. */
export interface DuplicateMatch {
    id: number;
    /** Where "Open" goes (opens in a new tab, so the half-filled form isn't lost). */
    href: string;
    /** Optional short code shown before the name, e.g. "CR-000042". */
    code?: string;
    name: string;
    /** Why it matched: "Same phone", "Same ID number", "Address 72% similar". */
    reasons: string[];
    /** A line under the name, e.g. the address. */
    detail?: string | null;
}

interface PossibleDuplicatesModalProps {
    matches: DuplicateMatch[] | null; // null = closed
    title: string;
    message: string;
    confirmLabel: string;
    isSubmitting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

// The "this might already be registered" warning, shared by the customer and
// staff forms. Nothing has been saved yet when it shows. Closing it (X,
// clicking outside, Cancel) just returns to the form -- except while the
// confirm is in progress, when it stays open until the save finishes.
export function PossibleDuplicatesModal({
    matches,
    title,
    message,
    confirmLabel,
    isSubmitting,
    onConfirm,
    onCancel,
}: PossibleDuplicatesModalProps) {
    return (
        <Modal isOpen={!!matches} onClose={() => !isSubmitting && onCancel()} title={title} size="md">
            <div className="space-y-4">
                <p className="flex items-start gap-2 font-semibold text-amber-800">
                    <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                    {message}
                </p>
                <ul className="space-y-2">
                    {/* "?? []": the list is built even while the modal is closed. */}
                    {(matches ?? []).map((m) => (
                        <li key={m.id} className="rounded-lg bg-white border border-amber-200 p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                {m.code && <span className="font-mono text-xs text-gray-500">{m.code}</span>}
                                <span className="font-semibold text-gray-900">{m.name}</span>
                                {m.reasons.map((reason) => (
                                    <span
                                        key={reason}
                                        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
                                    >
                                        {reason}
                                    </span>
                                ))}
                                <a
                                    href={m.href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-auto inline-flex items-center gap-1 text-primary hover:underline"
                                >
                                    Open <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                            </div>
                            {m.detail && <p className="mt-1 text-gray-600 wrap-break-word">{m.detail}</p>}
                        </li>
                    ))}
                </ul>
                <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={onConfirm} isLoading={isSubmitting}>
                        {confirmLabel}
                    </Button>
                    <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
                        Cancel
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
