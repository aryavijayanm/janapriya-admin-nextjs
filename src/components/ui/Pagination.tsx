import { Button } from "@/components/ui/Button";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

// How many pages to show immediately on each side of the current page.
const SIBLING_COUNT = 1;

type PageToken = number | "left-ellipsis" | "right-ellipsis";

function range(start: number, end: number): number[] {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

// Returns the sequence of page-number buttons (and ellipsis placeholders)
// to render -- always includes page 1 and the last page as fixed anchors,
// plus a small window around the current page, collapsing anything in
// between into a single "..." once there's more than one page gap to skip.
// Falls back to listing every page when the total is small enough that
// windowing wouldn't save any space anyway.
function getPageNumbers(currentPage: number, totalPages: number): PageToken[] {
    const totalVisibleIfNoWindowing = SIBLING_COUNT * 2 + 5;
    if (totalPages <= totalVisibleIfNoWindowing) {
        return range(1, totalPages);
    }

    const leftSibling = Math.max(currentPage - SIBLING_COUNT, 1);
    const rightSibling = Math.min(currentPage + SIBLING_COUNT, totalPages);

    const showLeftEllipsis = leftSibling > 2;
    const showRightEllipsis = rightSibling < totalPages - 1;

    if (!showLeftEllipsis && showRightEllipsis) {
        const leftRange = range(1, 3 + SIBLING_COUNT * 2);
        return [...leftRange, "right-ellipsis", totalPages];
    }

    if (showLeftEllipsis && !showRightEllipsis) {
        const rightRange = range(totalPages - (2 + SIBLING_COUNT * 2), totalPages);
        return [1, "left-ellipsis", ...rightRange];
    }

    return [1, "left-ellipsis", ...range(leftSibling, rightSibling), "right-ellipsis", totalPages];
}

// Dumb presentational primitive -- consumes whatever usePagination() (or
// any other page-state source) provides. No URL/fetch knowledge of its own.
export function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    const pages = getPageNumbers(currentPage, Math.max(totalPages, 1));

    return (
        // flex-wrap: Prev + up to 7 page tokens + Next is ~9 buttons, wider
        // than a phone. Wrapping onto a second row beats overflowing the card.
        <div className="flex flex-wrap items-center justify-center gap-1 pt-4">
            <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => onPageChange(currentPage - 1)}
            >
                Prev
            </Button>

            {pages.map((token) =>
                typeof token === "number" ? (
                    <Button
                        key={token}
                        type="button"
                        variant={token === currentPage ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => onPageChange(token)}
                    >
                        {token}
                    </Button>
                ) : (
                    <span key={token} className="px-2 text-sm text-gray-400">
                        …
                    </span>
                )
            )}

            <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => onPageChange(currentPage + 1)}
            >
                Next
            </Button>
        </div>
    );
}
