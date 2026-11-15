import { Inbox, type LucideIcon } from "lucide-react";

interface EmptyStateProps {
    /** What is missing, in plain words: "No orders found." */
    message: string;
    /** Leave out for the default inbox icon. */
    icon?: LucideIcon;
}

// The "nothing here" look, defined once: a soft pink circle with an icon over
// the message. Used by every table (Table.tsx) and the activity lists, so an
// empty list looks the same -- and calm, not broken -- everywhere.
export function EmptyState({ message, icon: Icon = Inbox }: EmptyStateProps) {
    return (
        <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Icon className="h-6 w-6 text-primary/70" aria-hidden />
            </span>
            <p className="text-sm text-gray-500">{message}</p>
        </div>
    );
}
