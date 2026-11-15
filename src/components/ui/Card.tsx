import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// The white box every page sits in -- defined ONCE here. Before this, the same
// class strings were pasted into ~25 files, so changing the look meant editing
// all of them. Now: change a line below and every card of that kind follows.
//
// Five kinds, because the app really has five different boxes (each string is
// exactly what those pages used before, so switching to <Card> changes nothing
// on screen):
//
//   page      the box around a whole table/form page     (Users, Orders, Payments, forms…)
//   section   a box among several on one page            (Accounts book, Activities)
//   details   the box around a details page, with a header band that runs to the
//             rounded edge -- hence overflow-hidden       (Customer, Order, Staff details)
//   inner     a smaller bordered block INSIDE a page     (sections on the details pages)
//   dashboard a dashboard tile; lifts with a pink border on hover
//
// Adding a sixth kind for a single page? Pass `className` instead -- a variant
// should be a look that repeats, or this file turns into the copy-paste again.
const variantClasses = {
    page: "p-4 sm:p-8 bg-white rounded-lg shadow-md",
    section: "bg-white rounded-lg shadow-md p-4 sm:p-6",
    details: "bg-white rounded-2xl shadow-md overflow-hidden",
    inner: "rounded-xl border border-gray-200 bg-white px-5 py-4 shadow-sm",
    // No background colour here -- the `tone` below supplies it.
    // No border: the shadow alone separates the tile from the page.
    // Hover: the tile "bulges" -- grows 3%, lifts 4px and casts a deeper
    // shadow. transform + shadow only (no size/margin change), so the cards
    // around it never move. motion-safe: people who switch off animations
    // get no movement, just the deeper shadow.
    dashboard:
        "block rounded-xl p-5 shadow-sm transition duration-200 ease-out hover:shadow-xl motion-safe:hover:-translate-y-1 motion-safe:hover:scale-[1.03]",
} as const;

// Dashboard tints, one per logo colour. Each is a soft wash of that colour
// (top-left) fading into the warm peach of the app background (bottom-right),
// laid over white so the text keeps full contrast. "/40" = 40% strength.
// Full class names on purpose (see widthClasses below for why).
// Exported so other "highlighted" things (the chosen tab in Tabs.tsx) can wear
// the very same colour as a dashboard card -- one definition, not a copy.
export const toneClasses = {
    white: "bg-white",
    pink: "bg-white bg-linear-to-br from-brand-pink/40 to-brand-peach/70",
    magenta: "bg-white bg-linear-to-br from-brand-magenta/40 to-brand-peach/70",
    purple: "bg-white bg-linear-to-br from-brand-purple/40 to-brand-peach/70",
    plum: "bg-white bg-linear-to-br from-brand-plum/35 to-brand-peach/70",
    // A different style on purpose: a round coral glow from the top-right
    // corner over white that turns sky blue at the bottom -- so it never reads as
    // "the same card in another colour" next to the diagonal ones.
    // The two layers are defined in globals.css (@utility bg-glow-coral).
    coral: "bg-glow-coral",
} as const;

// Full class names, not `max-w-${width}`: Tailwind finds classes by reading the
// source text, so a name built at runtime is never generated and silently does nothing.
const widthClasses = {
    "4xl": "max-w-4xl mx-auto",
    "5xl": "max-w-5xl mx-auto",
    "6xl": "max-w-6xl mx-auto",
    full: "max-w-full mx-auto",
} as const;

export type CardVariant = keyof typeof variantClasses;
export type CardWidth = keyof typeof widthClasses;
export type CardTone = keyof typeof toneClasses;

interface CardProps {
    variant: CardVariant;
    /** Caps the width and centres the card. Leave out = as wide as its parent. */
    width?: CardWidth;
    /** "section" for a self-contained block of the page; "div" otherwise (the default). */
    as?: "div" | "section";
    /** Dashboard tiles only: which logo colour tints the card. Default white. */
    tone?: CardTone;
    /** Makes the whole card a link (dashboard tiles that open a page). */
    href?: string;
    /**
     * Extra layout classes (space-y-4, flex…). ADDS to the card, it can't
     * reliably override it: `cn` here is plain clsx, so `p-2` next to the
     * card's `p-5` doesn't win. Need a different padding? That's a variant.
     */
    className?: string;
    children: ReactNode;
}

export function Card({ variant, width, tone = "white", as: Tag = "div", href, className, children }: CardProps) {
    const classes = cn(
        width && widthClasses[width],
        variantClasses[variant],
        variant === "dashboard" && toneClasses[tone],
        className,
    );

    if (href) {
        return (
            <Link href={href} className={classes}>
                {children}
            </Link>
        );
    }
    return <Tag className={classes}>{children}</Tag>;
}
