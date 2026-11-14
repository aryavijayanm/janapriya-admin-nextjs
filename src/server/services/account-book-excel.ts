import "server-only";

import ExcelJS from "exceljs";
import { formatDate } from "@/lib/date";
import { ACCOUNT_SOURCE_LABELS, accountModeLabel, type AccountExportRange } from "@/server/validators/account-book";
import type { AccountBookRow } from "@/server/services/account-book.service";

// Builds the Owner's .xlsx download from the book's rows. Kept apart from
// the service on purpose: the service decides WHICH rows (and who may see
// them); this file only decides how they look in Excel.
//
// Dates are written as real Excel dates (not text), so the Owner can sort
// and filter by date inside Excel. Voided rows never reach this file (the
// service leaves them out), so every row counts in the totals.

const RUPEES = "#,##,##0"; // Indian grouping: 1,00,000

/** "Rama · K7QT #2" / "Anu" -- who the row is about. */
function whoFor(row: AccountBookRow): string {
    if (!row.name) return "";
    return row.orderCode ? `${row.name} · ${row.orderCode} #${row.contractNumber}` : row.name;
}

export async function buildAccountBookXlsx(rows: AccountBookRow[], range: AccountExportRange): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Accounts book", { views: [{ state: "frozen", ySplit: 3 }] });

    sheet.columns = [
        { key: "date", width: 12, style: { numFmt: "dd/mm/yyyy" } },
        { key: "type", width: 20 },
        { key: "who", width: 28 },
        { key: "details", width: 36 },
        { key: "in", width: 13, style: { numFmt: RUPEES } },
        { key: "out", width: 13, style: { numFmt: RUPEES } },
        { key: "how", width: 18 },
        { key: "account", width: 18 },
        { key: "recordedBy", width: 16 },
    ];

    // Row 1: title. Row 3: headings (row 2 left blank).
    sheet.getCell("A1").value = `Accounts book: ${formatDate(range.from)} to ${formatDate(range.to)}`;
    sheet.getCell("A1").font = { bold: true, size: 14 };
    const heading = sheet.getRow(3);
    heading.values = ["Date", "Type", "Customer / Staff", "Details", "Receipts ₹", "Payments ₹", "How", "Account details", "Recorded by"];
    heading.font = { bold: true };
    heading.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };

    let totalIn = 0;
    let totalOut = 0;
    for (const row of rows) {
        if (row.direction === "IN") totalIn += row.amount;
        else totalOut += row.amount;
        sheet.addRow({
            date: row.date,
            type: ACCOUNT_SOURCE_LABELS[row.source],
            who: whoFor(row),
            details: row.remarks ?? "",
            in: row.direction === "IN" ? row.amount : null,
            out: row.direction === "OUT" ? row.amount : null,
            how: accountModeLabel(row.source, row.mode),
            account: row.accountDetails ?? "",
            recordedBy: row.recordedBy ?? "",
        });
    }

    // Totals.
    sheet.addRow({});
    const totals = sheet.addRow({ details: "Total", in: totalIn, out: totalOut });
    totals.font = { bold: true };
    const net = sheet.addRow({ details: "Net (Receipts − Payments)", in: totalIn - totalOut });
    net.font = { bold: true };

    return Buffer.from(await workbook.xlsx.writeBuffer());
}
