"use client";

import React, { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Card } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { DateTextInput } from "@/components/ui/DateTextInput";
import { parseDayMonthYear } from "@/lib/date";
import { useServerAction } from "@/hooks/useServerAction";
import { exportAccountBookAction } from "@/features/accounts/accounts.actions";
import { accountExportSchema } from "@/server/validators/account-book";

/** base64 text -> a file the browser saves (no new tab, no page change). */
function saveFile(base64: string, fileName: string) {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
}

// Owner only: pick a From and To date, get an Excel file of every row in
// between (both days included). Starts on this month so far.
export function ExportAccountsCard({ today }: { today: string }) {
    const [from, setFrom] = useState(`01/${today.slice(3)}`);
    const [to, setTo] = useState(today);
    const { run, isPending, error, setError } = useServerAction();

    const handleDownload = async (e: React.FormEvent) => {
        e.preventDefault();
        const range = { from: parseDayMonthYear(from), to: parseDayMonthYear(to) };
        if (!range.from || !range.to) {
            setError("Please type both dates as DD/MM/YYYY, e.g. 05/11/2026");
            return;
        }
        const check = accountExportSchema.safeParse(range);
        if (!check.success) {
            setError(check.error.issues[0]?.message ?? "Please check the dates.");
            return;
        }
        const result = await run(() => exportAccountBookAction(range));
        if (result.ok && "base64" in result) saveFile(result.base64, result.fileName);
    };

    return (
        <Card variant="section" as="section">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Download Excel</h3>
            <form onSubmit={handleDownload} className="flex flex-wrap items-end gap-4">
                <FormField label="From" htmlFor="export-from">
                    <DateTextInput id="export-from" value={from} onChange={setFrom} />
                </FormField>
                <FormField label="To" htmlFor="export-to">
                    <DateTextInput id="export-to" value={to} onChange={setTo} />
                </FormField>
                <Button type="submit" isLoading={isPending}>
                    <Download className="w-4 h-4" />
                    Download Excel
                </Button>
            </form>
            {error && <Alert variant="error" className="mt-3">{error}</Alert>}
        </Card>
    );
}
