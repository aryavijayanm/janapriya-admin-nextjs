import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

// A white card with a small uppercase title and an optional button on the
// right -- used by every block on the order pages. The box itself is the
// shared "inner" Card; this only adds the title row.
export function SectionCard({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
    return (
        <Card variant="inner" as="section">
            <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{title}</h3>
                {action}
            </div>
            {children}
        </Card>
    );
}
