import type { ReactNode } from "react";

// A white card with a small uppercase title and an optional button on the
// right -- used by every block on the order pages.
export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return (
        <section className="rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h3>
                {action}
            </div>
            {children}
        </section>
    );
}
