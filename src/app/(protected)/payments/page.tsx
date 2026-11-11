import { requireUser } from "@/app/_lib/session";
import { listPayments } from "@/server/services/payments-list.service";
import { paymentsListQuerySchema } from "@/server/validators/payments-list";
import { PaymentsTable } from "@/features/payments/PaymentsTable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The payments table. Thin: reads the filters from the URL, the service picks
// the orders and rows, the component shows them.
export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
    const { db, user } = await requireUser();

    // A repeated param (?page=1&page=2) arrives as an array; take the first.
    const raw = Object.fromEntries(
        Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    );
    const query = paymentsListQuerySchema.parse(raw);
    const result = await listPayments(db, user, query);

    return (
        <PaymentsTable
            orders={result.data}
            pagination={result.pagination}
            query={query}
            // OUTSIDER: every row is Kerala anyway (the service filters in the database), so no column.
            showBranch={user.role !== "OUTSIDER"}
            // Showing the filter is a convenience; the service decides what refund rows exist.
            showRefunds={user.role === "OWNER"}
        />
    );
}
