"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

type ModalSize = "sm" | "md" | "lg" | "xl";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    size?: ModalSize;
    children: ReactNode;
}

const sizeClasses: Record<ModalSize, string> = {
    sm: "max-w-md",
    md: "max-w-lg",
    lg: "max-w-3xl",
    xl: "max-w-6xl",
};

// Generic shell -- extracted from the overlay/panel pattern already used in
// components/modal/calendar.tsx (same bg-black/60 backdrop, rounded-2xl panel),
// so any future modal (not just the calendar) looks consistent without
// re-implementing the overlay markup each time. CalendarModal itself is left
// as-is for now; migrating it onto this shell is a future cleanup, not this one.
export function Modal({ isOpen, onClose, title, size = "md", children }: ModalProps) {
    // Rendered via a portal straight onto <body>, so this modal is never a
    // descendant of anything that creates its own stacking context (e.g. the
    // Navbar's `sticky z-40` header) -- otherwise its z-50 only wins fights
    // *inside* that ancestor, and something like the Sidebar's real z-50
    // outside it can still paint on top. `mounted` guards against `document`
    // not existing during server-side rendering.
    const [mounted, setMounted] = useState(false);
    useEffect(() => {
        // Deliberate: server has no `document`, so server + first client
        // render must both render nothing (avoiding a hydration mismatch);
        // this effect then flips `mounted` to allow the portal on the next render.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMounted(true);
    }, []);

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className={`bg-white w-full ${sizeClasses[size]} rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]`}
                onClick={(e) => e.stopPropagation()}
            >
                {title && (
                    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-bold text-gray-800">{title}</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close"
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            <X size={20} />
                        </button>
                    </div>
                )}
                <div className="overflow-y-auto p-6">{children}</div>
            </div>
        </div>,
        document.body,
    );
}
