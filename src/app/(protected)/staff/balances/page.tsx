import { requireUser } from "@/app/_lib/session";
import { listStaffBalances } from "@/server/services/staff-balance.service";
import { staffBalanceQuerySchema } from "@/server/validators/staff-balance";
import { StaffBalances } from "@/features/staff/StaffBalances";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Staff balances (look-up). Thin: reads the filters from the URL, the service
// reads the stored balances (no calculation here), the component shows them.
export default async function StaffBalancesPage({ searchParams }: { searchParams: SearchParams }) {
    const { db, user } = await requireUser();

    // A repeated param (?page=1&page=2) arrives as an array; take the first.
    const raw = Object.fromEntries(
        Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    );
    const query = staffBalanceQuerySchema.parse(raw);
    const result = await listStaffBalances(db, user, query);

    return <StaffBalances rows={result.data} pagination={result.pagination} query={query} />;
}
