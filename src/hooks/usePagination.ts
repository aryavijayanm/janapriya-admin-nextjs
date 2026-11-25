"use client";

import { useCallback } from "react";
import { useUrlParams } from "./useUrlParams";

// Page-number state in the URL -- knows nothing about what's being paginated
// or how to fetch it. The change goes through useUrlParams, so `isPending`
// says when the next page is still loading.
export function usePagination() {
    const { searchParams, setParams, isPending } = useUrlParams();

    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const setPage = useCallback((newPage: number) => setParams({ page: String(newPage) }), [setParams]);

    return { page, setPage, isPending };
}
