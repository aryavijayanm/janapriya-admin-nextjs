import { Key, ReactNode } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface TableColumn<T> {
    header: string;
    // Either a direct field name on the row, or a render function for
    // computed/formatted cells (e.g. an actions column with buttons).
    accessor: keyof T | ((row: T) => ReactNode);
    className?: string;
    // Present only on columns the backend actually knows how to sort by --
    // this is the key sent to onSortChange, not a display value.
    sortKey?: string;
    // A sort nobody should notice: the header looks exactly like plain text
    // (no arrows, no hover) but still sends sortKey when clicked. Used for the
    // staff list's "latest registered first" behind the Actions header.
    quietSort?: boolean;
}

interface TableProps<T> {
    columns: TableColumn<T>[];
    data: T[];
    getRowKey: (row: T) => Key;
    emptyMessage?: string;
    // Optional -- tables that don't pass it behave exactly as before.
    onRowClick?: (row: T) => void;
    // These three are optional as a set -- a column needs both its own
    // sortKey AND onSortChange present to render as clickable; omit all
    // three and every header renders exactly as before.
    sortBy?: string;
    sortDir?: "asc" | "desc";
    onSortChange?: (key: string) => void;
}

// Generic reusable table for future list pages (customer/staff/user), so each
// one just supplies its own `columns` instead of hand-writing a <table> again.
export function Table<T>({
    columns,
    data,
    getRowKey,
    emptyMessage = "No records found.",
    onRowClick,
    sortBy,
    sortDir,
    onSortChange,
}: TableProps<T>) {
    return (
        <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
            {/* max-md:whitespace-nowrap -- on a phone, let the container scroll
                sideways instead of wrapping every cell into a tall, narrow
                sliver. Desktop wrapping is unchanged. */}
            <table className="min-w-full divide-y divide-gray-200 max-md:whitespace-nowrap">
                <thead className="bg-gray-200">
                    <tr className="divide-x divide-gray-300">
                        {columns.map((col, colIndex) => {
                            const sortable = col.sortKey && onSortChange;
                            const isActive = sortable && sortBy === col.sortKey;
                            return (
                                <th
                                    key={col.header}
                                    className={cn(
                                        "px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider",
                                        // Needs its own opaque background so body cells scrolling
                                        // underneath the pinned header cell don't show through.
                                        colIndex === 0 && "sticky left-0 z-10 bg-gray-200",
                                    )}
                                >
                                    {sortable && col.quietSort ? (
                                        // "uppercase": buttons don't inherit text-transform from the <th>.
                                        <button
                                            type="button"
                                            onClick={() => onSortChange(col.sortKey!)}
                                            className="uppercase cursor-default"
                                        >
                                            {col.header}
                                        </button>
                                    ) : sortable ? (
                                        <button
                                            type="button"
                                            onClick={() => onSortChange(col.sortKey!)}
                                            className="inline-flex items-center gap-1 hover:text-gray-900"
                                        >
                                            {col.header}
                                            {isActive ? (
                                                sortDir === "asc" ? (
                                                    <ChevronUp className="w-3.5 h-3.5" />
                                                ) : (
                                                    <ChevronDown className="w-3.5 h-3.5" />
                                                )
                                            ) : (
                                                <ChevronsUpDown className="w-3.5 h-3.5 text-gray-400" />
                                            )}
                                        </button>
                                    ) : (
                                        col.header
                                    )}
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="px-4 py-8 text-center text-sm text-gray-400"
                            >
                                {emptyMessage}
                            </td>
                        </tr>
                    ) : (
                        data.map((row, index) => (
                            <tr
                                key={getRowKey(row)}
                                onClick={onRowClick ? () => onRowClick(row) : undefined}
                                className={`divide-x divide-gray-300 ${index % 2 === 0 ? "bg-white" : "bg-gray-100"} hover:bg-gray-300 ${onRowClick ? "cursor-pointer" : ""}`}
                            >
                                {columns.map((col, colIndex) => (
                                    <td
                                        key={col.header}
                                        className={cn(
                                            col.className ?? "px-4 py-3 text-sm text-gray-900",
                                            // First column stays pinned while the rest scrolls, so you
                                            // always know whose row you're reading. bg-inherit copies
                                            // the row's own colour -- zebra stripe AND hover -- which
                                            // a hardcoded background could not follow.
                                            colIndex === 0 && "sticky left-0 z-10 bg-inherit",
                                        )}
                                    >
                                        {typeof col.accessor === "function"
                                            ? col.accessor(row)
                                            : (row[col.accessor] as ReactNode)}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
    );
}
