"use client";

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

// A row of tabs (underlined when chosen). Only the buttons -- the page shows
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
                        className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors ${
                            active ? "border-primary text-primary" : "border-transparent text-gray-500 hover:text-gray-800"
                        }`}
                    >
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
