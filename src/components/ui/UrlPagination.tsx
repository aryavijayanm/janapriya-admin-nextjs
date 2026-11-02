"use client";

import { Pagination } from "@/components/ui/Pagination";
import { usePagination } from "@/hooks/usePagination";

// Page buttons whose page lives in the URL (?page=2), for lists a Server
// Component slices itself -- the page re-renders on the server with the new
// page. Same pieces as the other lists: Pagination + usePagination.
export function UrlPagination({ currentPage, totalPages }: { currentPage: number; totalPages: number }) {
    const { setPage } = usePagination();
    if (totalPages <= 1) return null;
    return <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />;
}
