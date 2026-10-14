"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// Pure URL page-state mechanics only -- knows nothing about what's being
// paginated or how to fetch it. Reused by any future paginated list.
export function usePagination() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const setPage = useCallback(
        (newPage: number) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("page", String(newPage));
            router.push(`?${params.toString()}`);
        },
        [searchParams, router],
    );

    return { page, setPage };
}
