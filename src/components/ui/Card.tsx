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
    dashboard: "block rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-primary hover:shadow-md",
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

interface CardProps {
    variant: CardVariant;
    /** Caps the width and centres the card. Leave out = as wide as its parent. */
    width?: CardWidth;
    /** "section" for a self-contained block of the page; "div" otherwise (the default). */
    as?: "div" | "section";
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

export function Card({ variant, width, as: Tag = "div", href, className, children }: CardProps) {
    const classes = cn(width && widthClasses[width], variantClasses[variant], className);

    if (href) {
        return (
            <Link href={href} className={classes}>
                {children}
            </Link>
        );
    }
    return <Tag className={classes}>{children}</Tag>;
}
