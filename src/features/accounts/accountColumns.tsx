"use client";

import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { TableColumn } from "@/components/ui/Table";
import { formatDate } from "@/lib/date";
import { formatRupees } from "@/lib/money";
import type { AccountBookRow } from "@/server/services/account-book.service";
import { ACCOUNT_SOURCE_LABELS, accountModeLabel } from "@/server/validators/account-book";

/** "Rama · K7QT #2 · Patient in hospital" -- what the row is about. */
function details(row: AccountBookRow): string {
    const who = row.name ? (row.orderCode ? `${row.name} · ${row.orderCode} #${row.contractNumber}` : row.name) : null;
    return [who, row.remarks].filter(Boolean).join(" · ");
}

/** Crossed out and grey when the row was voided where it was entered. */
const strike = (row: AccountBookRow) => (row.voidedAt ? "line-through text-gray-400" : "");

/** The amount, in its column's colour -- grey and crossed out when voided. */
function amountCell(row: AccountBookRow, colour: string) {
    return (
        <span className={`font-semibold tabular-nums ${row.voidedAt ? "line-through text-gray-400" : colour}`}>
            {formatRupees(row.amount)}
        </span>
    );
}

/**
 * The book's columns -- written once, used by the day card and the month
 * table, so both always look the same.
 *   showDate -- false in the day card (every row is that day)
 *   onEdit / onDelete -- the icons on typed entries (other rows have none);
 *                        leave both out for a read-only table (activities)
 */
export function accountColumns({
    showDate,
    onEdit,
    onDelete,
}: {
    showDate: boolean;
    onEdit?: (row: AccountBookRow) => void;
    onDelete?: (row: AccountBookRow) => void;
}): TableColumn<AccountBookRow>[] {
    const actions: TableColumn<AccountBookRow>[] =
        onEdit && onDelete
            ? [
                  {
                      header: "Actions",
                      accessor: (row) =>
                          // Only typed entries can be changed here.
                          row.source === "ENTRY" ? (
                              <div className="flex gap-1">
                                  <Button size="sm" variant="ghost" aria-label="Edit entry" onClick={() => onEdit(row)}>
                                      <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-600"
                                      aria-label="Delete entry"
                                      onClick={() => onDelete(row)}
                                  >
                                      <Trash2 className="w-4 h-4" />
                                  </Button>
                              </div>
                          ) : null,
                  },
              ]
            : [];

    return [
        ...(showDate
            ? [{ header: "Date", accessor: (row: AccountBookRow) => <span className={strike(row)}>{formatDate(row.date)}</span> }]
            : []),
        { header: "Type", accessor: (row) => <span className={strike(row)}>{ACCOUNT_SOURCE_LABELS[row.source]}</span> },
        {
            header: "Details",
            accessor: (row) => (
                <div className="max-w-md whitespace-normal">
                    <span className={strike(row)}>{details(row) || "—"}</span>
                    {row.voidedAt && (
                        <p className="mt-0.5 text-xs text-red-700">
                            Voided by {row.voidedBy ?? "a removed user"} on {formatDate(row.voidedAt)}: {row.voidReason}
                        </p>
                    )}
                </div>
            ),
        },
        // Money in shows under Receipts, money out under Payments (the other cell stays empty).
        // Receipts first, Payments second -- the same order everywhere (owner's decision).
        { header: "Receipts", accessor: (row) => (row.direction === "IN" ? amountCell(row, "text-green-700") : null) },
        { header: "Payments", accessor: (row) => (row.direction === "OUT" ? amountCell(row, "text-red-700") : null) },
        { header: "How", accessor: (row) => <span className={strike(row)}>{accountModeLabel(row.source, row.mode)}</span> },
        ...actions,
    ];
}
