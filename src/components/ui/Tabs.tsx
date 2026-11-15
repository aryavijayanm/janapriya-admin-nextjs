"use client";

import { toneClasses } from "@/components/ui/Card";

export interface TabItem<K extends string> {
    key: K;
    label: string;
    /** Shown as a small number after the label. */
    count?: number;
}

interface TabsProps<K extends string> {
    tabs: TabItem<K>[];
    value: K;
    onChange: (key: K) => void;
}

// A row of tabs (an underline draws in under the chosen one). Only the buttons -- the page shows
// the chosen tab's content itself. Reusable for any tabbed page.
export function Tabs<K extends string>({ tabs, value, onChange }: TabsProps<K>) {
    return (
        <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-gray-200">
            {tabs.map((tab) => {
                const active = tab.key === value;
                return (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={active}
                        onClick={() => onChange(tab.key)}
                        // flex-1: the tabs share the full row equally. min-w-fit: on a
                        // narrow phone they never squash below their text -- the row
                        // scrolls sideways instead. uppercase is CSS only, so the labels
                        // stay normal text in the code (and for screen readers).
                        className={`relative -mb-px flex min-w-fit flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold uppercase tracking-wide transition-colors ${
                            // Chosen tab = a little dashboard card: the same pink
                            // wash (shared from Card.tsx) and shadow; square corners,
                            // black text.
                            active
                                ? `${toneClasses.pink} text-black shadow-md`
                                : "text-gray-500 hover:bg-white/60 hover:text-gray-800"
                        }`}
                    >
                        {/* The underline "draws" itself left to right: it is always
                            there, just squashed to zero width (scale-x-0) until the
                            tab is chosen. Animating transform (not width) is cheap --
                            the browser's GPU does it without re-laying out the page.
                            motion-safe: people who turn animations off in their
                            system settings get the line instantly, no movement. */}
                        <span
                            aria-hidden
                            className={`absolute inset-x-0 bottom-0 h-0.5 origin-left rounded-full bg-primary motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-out ${
                                active ? "scale-x-100" : "scale-x-0"
                            }`}
                        />
                        {tab.label}
                        {tab.count !== undefined && (
                            <span
                                className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-primary text-white" : "bg-gray-100 text-gray-600"}`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
