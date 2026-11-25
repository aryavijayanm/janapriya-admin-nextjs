"use client";

import { useCallback } from "react";
import { useUrlParams } from "./useUrlParams";

export type SortDir = "asc" | "desc";

// Sort state in the URL -- knows nothing about which fields are sortable or
// how to fetch. Every change goes back to page 1 (useUrlParams does that):
// page numbers from the old order mean nothing under a new one.
export function useSort() {
    const { searchParams, setParams, isPending } = useUrlParams();

    const sortBy = searchParams.get("sortBy") ?? undefined;
    const sortDir = (searchParams.get("sortDir") as SortDir | null) ?? undefined;

    const toggleSort = useCallback(
        (key: string) =>
            setParams(sortBy === key ? { sortDir: sortDir === "asc" ? "desc" : "asc" } : { sortBy: key, sortDir: "asc" }),
        [setParams, sortBy, sortDir],
    );

    // On/off instead of asc/desc: first click sorts by `key` in `dir`, the next
    // click removes the sort, back to the list's normal order. (The quiet
    // "latest registered first" sort on the staff list.)
    const toggleSortOnOff = useCallback(
        (key: string, dir: SortDir) =>
            setParams(sortBy === key ? { sortBy: null, sortDir: null } : { sortBy: key, sortDir: dir }),
        [setParams, sortBy],
    );

    return { sortBy, sortDir, toggleSort, toggleSortOnOff, isPending };
}
