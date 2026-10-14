"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export type SortDir = "asc" | "desc";

// Pure URL sort-state mechanics only -- mirrors usePagination.ts exactly,
// knows nothing about which fields are sortable or how to fetch. Reused by
// any future sortable list.
export function useSort() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const sortBy = searchParams.get("sortBy") ?? undefined;
    const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? undefined;

    const toggleSort = useCallback(
        (key: string) => {
            const params = new URLSearchParams(searchParams.toString());
            if (sortBy === key) {
                params.set("sortDir", sortDir === "asc" ? "desc" : "asc");
            } else {
                params.set("sortBy", key);
                params.set("sortDir", "asc");
            }
            // Page numbers from the old order don't mean anything under a
            // new one -- always jump back to the first page of the new sort.
            params.set("page", "1");
            router.push(`?${params.toString()}`);
        },
        [searchParams, router, sortBy, sortDir],
    );

    return { sortBy, sortDir, toggleSort };
}
