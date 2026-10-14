import { Key } from "react";
import { Table, type TableColumn } from "@/components/ui/Table";
import { Pagination } from "@/components/ui/Pagination";
import { Spinner } from "@/components/ui/Spinner";

interface DataTableProps<T> {
    columns: TableColumn<T>[];
    data: T[];
    getRowKey: (row: T) => Key;
    isLoading: boolean;
    emptyMessage?: string;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onRowClick?: (row: T) => void;
    sortBy?: string;
    sortDir?: "asc" | "desc";
    onSortChange?: (key: string) => void;
}

// Thin composite bundling the already-existing Table + the new Pagination,
// plus a loading state -- so each feature's table component doesn't
// re-implement "spinner while loading, else table + pagination" every time.
// No business logic of its own.
export function DataTable<T>({
    columns,
    data,
    getRowKey,
    isLoading,
    emptyMessage,
    currentPage,
    totalPages,
    onPageChange,
    onRowClick,
    sortBy,
    sortDir,
    onSortChange,
}: DataTableProps<T>) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner size="lg" />
            </div>
        );
    }

    return (
        <>
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
        </>
    );
}
