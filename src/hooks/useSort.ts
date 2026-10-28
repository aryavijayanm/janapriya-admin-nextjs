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

    // On/off instead of asc/desc: first click sorts by `key` in `dir`, the next
    // click removes the sort, back to the list's normal order. (The quiet
    // "latest registered first" sort on the staff list.)
    const toggleSortOnOff = useCallback(
        (key: string, dir: SortDir) => {
            const params = new URLSearchParams(searchParams.toString());
            if (sortBy === key) {
                params.delete("sortBy");
                params.delete("sortDir");
            } else {
                params.set("sortBy", key);
                params.set("sortDir", dir);
            }
            params.set("page", "1");
            router.push(`?${params.toString()}`);
        },
        [searchParams, router, sortBy],
    );

    return { sortBy, sortDir, toggleSort, toggleSortOnOff };
}
