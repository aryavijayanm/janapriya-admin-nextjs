import { requireUser } from "@/app/_lib/session";
import { listStaff } from "@/server/services/staff.service";
import { listActiveServices } from "@/server/services/service.service";
import { staffListQuerySchema } from "@/server/validators/staff";
import StaffTable from "@/features/staff/staffTable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// The old page rendered StaffTable, which then fetched in a useEffect. Here the
// server reads page/sort/filter/search straight from the URL, queries, and
// hands the result down -- so changing any of them is just a URL change,
// which re-runs this function with the new values.
export default async function StaffPage({ searchParams }: { searchParams: SearchParams }) {
    const { db, user } = await requireUser();

    // A repeated param (?page=1&page=2) arrives as an array; take the first.
    const raw = Object.fromEntries(
        Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    );
    // The URL is user-editable, so it's validated like any other input --
    // a nonsense value falls back to the default instead of crashing the page.
    const query = staffListQuerySchema.parse(raw);

    const [result, services] = await Promise.all([
        listStaff(db, user, query),
        listActiveServices(db, user),
    ]);

    return <StaffTable staff={result.data} pagination={result.pagination} services={services} />;
}
