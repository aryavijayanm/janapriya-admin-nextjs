import { requireUser } from "@/app/_lib/session";
import { listOrders } from "@/server/services/order.service";
import { orderListQuerySchema } from "@/server/validators/order";
import OrderTable from "@/features/order/orderTable";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Same shape as the staff and customer lists: read page/status/branch/search
// from the URL, query, hand the result down. The branch rule is applied
// inside listOrders, so an OUTSIDER never receives OUTSIDE orders here.
export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
    const { db, user } = await requireUser();

    // A repeated param (?page=1&page=2) arrives as an array; take the first.
    const raw = Object.fromEntries(
        Object.entries(await searchParams).map(([key, value]) => [key, Array.isArray(value) ? value[0] : value]),
    );
    const query = orderListQuerySchema.parse(raw);

    const result = await listOrders(db, user, query);
    return (
        <OrderTable
            orders={result.data}
            pagination={result.pagination}
            // The branch filter only offers OUTSIDE to those who can see it.
            canSeeOutside={user.role !== "OUTSIDER"}
        />
    );
}
