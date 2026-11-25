import { Key } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";

interface DataTableProps<T> {
    columns: TableColumn<T>[];
    data: T[];
    getRowKey: (row: T) => Key;
    /**
     * True while a filter / sort / page change is loading the next rows (the
     * `isPending` from useUrlParams, usePagination or useSort). The rows stay
     * on screen, dimmed, with a spinner over them -- swapping them for a big
     * spinner would make the page jump.
     */
    isPending?: boolean;
    emptyMessage?: string;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onRowClick?: (row: T) => void;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    onSortChange?: (key: string) => void;
}

// Thin composite bundling Table + Pagination + the "next rows are loading"
// look -- so each feature's table component doesn't re-implement it.
// No business logic of its own.
//
// The loading look is plain CSS keyed on a `data-pending` attribute (the
// pattern from the Next.js 16 docs): the attribute is on this element, the
// dimming uses Tailwind's group-data-pending: variant. Both wait 150ms, so a
// fast load doesn't flicker.
export function DataTable<T>({
    columns,
    data,
    getRowKey,
    isPending = false,
    emptyMessage,
    currentPage,
    totalPages,
    onPageChange,
    onRowClick,
    sortBy,
    sortDir,
    onSortChange,
}: DataTableProps<T>) {
    return (
        <div className="group relative" data-pending={isPending ? "" : undefined} aria-busy={isPending || undefined}>
            <div className="transition-opacity duration-200 group-data-pending:pointer-events-none group-data-pending:opacity-50 group-data-pending:delay-150">
                <Table
                    columns={columns}
                    data={data}
                    getRowKey={getRowKey}
                    emptyMessage={emptyMessage}
                    onRowClick={onRowClick}
                    sortBy={sortBy}
                    sortDir={sortDir}
                    onSortChange={onSortChange}
                />
                <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={onPageChange} />
            </div>
            {isPending && (
                <div
                    className="pointer-events-none absolute inset-x-0 top-12 flex justify-center motion-safe:animate-fade-in"
                    // Same 150ms wait as the dimming; "both" keeps it hidden until then.
                    style={{ animationDelay: "150ms", animationFillMode: "both" }}
                >
                    <Spinner size="lg" className="text-primary" />
                </div>
            )}
        </div>
    );
}
