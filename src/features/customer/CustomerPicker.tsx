"use client";

import { useEffect, useRef, useState } from "react";
import { Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { searchActiveCustomersAction } from "@/features/customer/customer.actions";
import { formatCustomerCode } from "@/server/validators/customer";
import type { CustomerOption } from "@/server/services/customer.service";

interface CustomerPickerProps {
    value: CustomerOption | null;
    onChange: (customer: CustomerOption | null) => void;
    /** Show the chosen customer without a Change button (e.g. editing an order). */
    readOnly?: boolean;
}

/** Wait this long after the last keystroke before searching. */
const SEARCH_DELAY_MS = 300;

// Reusable "which customer?" field: a search box until a customer is chosen,
// then a small card with a Change button. Only ACTIVE customers are offered
// (only they can get new orders).
export function CustomerPicker({ value, onChange, readOnly = false }: CustomerPickerProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<CustomerOption[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [searched, setSearched] = useState(false);
    const [error, setError] = useState("");

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Each search gets a number; a reply is used only if it's still the latest.
    // Otherwise a slow reply for "ra" could overwrite the one for "rama".
    const latestSearchRef = useRef(0);

    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    const runSearch = async (text: string) => {
        const searchNumber = ++latestSearchRef.current;
        setIsSearching(true);
        setError("");
        const result = await searchActiveCustomersAction(text);
        if (searchNumber !== latestSearchRef.current) return; // a newer search has started
        setIsSearching(false);
        setSearched(true);
        if (result.ok) {
            setResults(result.customers);
        } else {
            setResults([]);
            setError(result.error);
        }
    };

    const handleTyping = (text: string) => {
        setQuery(text);
        if (timerRef.current) clearTimeout(timerRef.current);
        if (text.trim() === "") {
            latestSearchRef.current++; // abandon any search in flight
            setResults([]);
            setSearched(false);
            setIsSearching(false);
            return;
        }
        timerRef.current = setTimeout(() => void runSearch(text.trim()), SEARCH_DELAY_MS);
    };

    if (value) {
        return (
            <div className="flex items-start justify-between gap-3 rounded-lg border border-gray-300 bg-gray-50 p-3">
                <div className="min-w-0">
                    <p className="font-semibold text-gray-900">
                        <span className="font-mono text-xs text-gray-500 mr-2">{formatCustomerCode(value.id)}</span>
                        {value.name}
                    </p>
                    <p className="text-sm text-gray-600">{value.contactNumber1}</p>
                    <p className="text-sm text-gray-500 wrap-break-word">{value.address}</p>
                </div>
                {!readOnly && (
                    <Button type="button" variant="secondary" size="sm" onClick={() => onChange(null)}>
                        Change
                    </Button>
                )}
            </div>
        );
    }

    return (
        <div className="relative">
            <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 pointer-events-none">
                    <Search className="h-4 w-4" />
                </span>
                <input
                    type="text"
                    value={query}
                    onChange={(e) => handleTyping(e.target.value)}
                    placeholder="Search by name, phone, address or CR-…"
                    className="input-field pl-9"
                    autoComplete="off"
                />
                {isSearching && (
                    <span className="absolute inset-y-0 right-3 flex items-center text-gray-400">
                        <Spinner size="sm" />
                    </span>
                )}
            </div>

            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

            {query.trim() !== "" && searched && !isSearching && (
                <ul className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm divide-y divide-gray-100">
                    {results.length === 0 ? (
                        <li className="px-3 py-3 text-sm text-gray-500">No active customers match.</li>
                    ) : (
                        results.map((customer) => (
                            <li key={customer.id}>
                                <button
                                    type="button"
                                    onClick={() => onChange(customer)}
                                    className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-primary/5"
                                >
                                    <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-gray-900">
                                            <span className="font-mono text-xs text-gray-500 mr-2">
                                                {formatCustomerCode(customer.id)}
                                            </span>
                                            {customer.name} · {customer.contactNumber1}
                                        </span>
                                        <span className="block truncate text-xs text-gray-500">{customer.address}</span>
                                    </span>
                                </button>
                            </li>
                        ))
                    )}
                </ul>
            )}
        </div>
    );
}
