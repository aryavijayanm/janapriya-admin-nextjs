"use client";

/**
 * A labelled row of filter buttons; the chosen one is highlighted.
 * Used by the staff balances and payments lists.
 */
export function FilterGroup<T extends string>({
    label,
    options,
    labels,
    value,
    onChange,
}: {
    label: string;
    options: readonly T[];
    labels: Record<T, string>;
    value: T;
    onChange: (value: T) => void;
}) {
    return (
        <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{label}</p>
            <div className="inline-flex flex-wrap rounded-lg border border-gray-200 p-0.5">
                {options.map((option) => (
                    <button
                        key={option}
                        type="button"
                        onClick={() => onChange(option)}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                            value === option ? "bg-primary text-white" : "text-gray-600 hover:bg-gray-100"
                        }`}
                    >
                        {labels[option]}
                    </button>
                ))}
            </div>
        </div>
    );
}
