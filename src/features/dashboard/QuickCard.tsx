import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

// The four logo colours, flat (no gradient) -- the same colours the big
// dashboard cards fade from (globals.css --brand-*). "/75" = 75% strength, so
// they come out softer over the light page. White text on each.
const COLOURS = {
    pink: "bg-brand-pink/75",
    magenta: "bg-brand-magenta/75",
    purple: "bg-brand-purple/75",
    coral: "bg-brand-coral/75",
    // Not a logo colour. Deeper than --brand-sky (the pale blue at the end of
    // dashboard card 4), because white text on that pale blue can't be read.
    sky: "bg-sky-500/75",
} as const;

export type QuickCardColour = keyof typeof COLOURS;

interface QuickCardProps {
    colour: QuickCardColour;
    /** Shown top-right, in white. */
    icon: LucideIcon;
    /** What the number counts, e.g. "Customers". */
    label: string;
    value: number;
    /** A short line under the number, e.g. "incl. disabled". */
    note?: string;
}

/**
 * One of the Owner's small solid-colour boxes on the dashboard: a label and
 * one big number, all in white. A rectangle with no fixed size: the dashboard
 * grid gives it its width, and its height is the row's height -- the same as
 * the big cards beside/below it (see dashboard/page.tsx).
 */
export function QuickCard({ colour, icon: Icon, label, value, note }: QuickCardProps) {
    return (
        // relative + overflow-hidden: the decoration circles below sit in the
        // corner and are cut off at the card's rounded edge.
        <div className={cn("relative flex flex-col justify-between overflow-hidden rounded-xl p-4 text-white shadow-sm", COLOURS[colour])}>
            {/* Decoration only: two faint white circles peeking in from the
                bottom-right corner. Pure CSS shapes -- no images to load. */}
            <span aria-hidden className="pointer-events-none absolute -bottom-10 -right-10 h-32 w-32 rounded-full bg-white/15" />
            <span aria-hidden className="pointer-events-none absolute -bottom-4 right-10 h-16 w-16 rounded-full bg-white/10" />

            {/* "relative" keeps the text and icon above the circles. */}
            <div className="relative flex items-start justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider">{label}</p>
                {/* A soft white circle behind a white icon (aria-hidden: the label already says it). */}
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
                    <Icon className="h-7 w-7 text-white" aria-hidden />
                </span>
            </div>
            <div className="relative">
                <p className="text-5xl font-bold tabular-nums leading-tight">{value.toLocaleString("en-IN")}</p>
                {note && <p className="text-xs">{note}</p>}
            </div>
        </div>
    );
}
