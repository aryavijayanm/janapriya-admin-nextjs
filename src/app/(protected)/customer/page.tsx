import { requireUser } from "@/app/_lib/session";
import { listCustomers } from "@/server/services/customer.service";
import { customerListQuerySchema } from "@/server/validators/customer";
import CustomerTable from "@/features/customer/customerTable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Same shape as the staff list: read page/sort/search from the URL, query,
// hand the result down. Changing any of them is just a URL change.
export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
    const { db, user } = await requireUser();

    // A repeated param (?page=1&page=2) arrives as an array; take the first.
    const raw = Object.fromEntries(
        Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    );
    // User-editable URL -> validated; bad values fall back instead of crashing.
    const query = customerListQuerySchema.parse(raw);

    const result = await listCustomers(db, user, query);
    return <CustomerTable customers={result.data} pagination={result.pagination} />;
}
