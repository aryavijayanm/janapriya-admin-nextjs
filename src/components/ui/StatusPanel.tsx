import type { ReactNode } from "react";
import { Card } from "./Card";

interface StatusPanelProps {
    /** A lucide icon, already sized (e.g. <TriangleAlert className="w-7 h-7" />). */
    icon: ReactNode;
    title: string;
    message: string;
    /** The buttons / links under the message. */
    children: ReactNode;
    /** Small grey line at the bottom, e.g. the error reference. */
    footnote?: string;
}

// The "something is wrong with this page" panel -- shared by the error page
// and the not-found page so both look the same. No hooks, so it works in a
// Server Component (not-found) and a Client Component (error) alike.
export function StatusPanel({ icon, title, message, children, footnote }: StatusPanelProps) {
    return (
        <Card variant="page" width="4xl">
            <div className="flex flex-col items-center gap-3 py-6 text-center">
                <div className="rounded-full bg-primary/10 p-3 text-primary">{icon}</div>
                <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
                <p className="max-w-md text-gray-600">{message}</p>
                <div className="mt-2 flex flex-wrap justify-center gap-3">{children}</div>
                {footnote && <p className="mt-2 font-mono text-xs text-gray-400">{footnote}</p>}
            </div>
        </Card>
    );
}
