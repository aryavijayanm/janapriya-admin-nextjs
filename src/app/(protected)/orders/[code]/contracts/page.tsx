import { loadOrderPage, pageParam } from "@/app/_lib/order-page";
import { latestPage } from "@/lib/latestPage";
import { UrlPagination } from "@/components/ui/UrlPagination";
import { ContractsSection } from "@/features/order/ContractsSection";
import { OrderSubpage } from "@/features/order/OrderSubpage";

/** Contracts per page: page 1 = the latest 25, shown oldest first. */
const CONTRACTS_PER_PAGE = 25;

type Params = Promise<{ code: string }>;
type SearchParams = Promise<{ page?: string | string[] }>;

// All of an order's contracts -- the same table and actions as the order page.
export default async function OrderContractsPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    const { order, nextContract, leaveDays, today } = await loadOrderPage((await params).code);
    const slice = latestPage(order.contracts, CONTRACTS_PER_PAGE, pageParam((await searchParams).page));

    return (
        <OrderSubpage order={order} title="All contracts">
            <ContractsSection
                order={order}
                contracts={slice.items}
                leaveDays={leaveDays}
                nextContract={nextContract}
                today={today}
                footer={<UrlPagination currentPage={slice.page} totalPages={slice.totalPages} />}
            />
        </OrderSubpage>
    );
}
