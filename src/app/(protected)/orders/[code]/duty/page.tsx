import { loadOrderPage, pageParam } from "@/app/_lib/order-page";
import { latestPage } from "@/lib/latestPage";
import { UrlPagination } from "@/components/ui/UrlPagination";
import { DutySection } from "@/features/order/DutySection";
import { OrderSubpage } from "@/features/order/OrderSubpage";

/** Duty periods per page: page 1 = the latest 15, shown oldest first (gap lines don't count). */
const DUTIES_PER_PAGE = 15;

type Params = Promise<{ code: string }>;
type SearchParams = Promise<{ page?: string | string[] }>;

// All of an order's duty periods -- the same timeline and actions as the order page.
export default async function OrderDutyPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    const { order, gaps, today } = await loadOrderPage((await params).code);
    const slice = latestPage(order.duties, DUTIES_PER_PAGE, pageParam((await searchParams).page));

    return (
        <OrderSubpage order={order} title="All staff duty">
            <DutySection
                order={order}
                duties={slice.items}
                gaps={gaps}
                today={today}
                footer={<UrlPagination currentPage={slice.page} totalPages={slice.totalPages} />}
            />
        </OrderSubpage>
    );
}
