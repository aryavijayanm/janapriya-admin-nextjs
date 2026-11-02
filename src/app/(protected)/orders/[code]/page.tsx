import { loadOrderPage } from "@/app/_lib/order-page";
import OrderDetails from "@/features/order/orderDetails";

type Params = Promise<{ code: string }>;

// The order page. Thin: loadOrderPage() loads the order and works out the
// domain numbers (gaps, next contract, leave days) -- shared with the
// "all contracts" and "all staff duty" pages so all three agree.
export default async function OrderPage({ params }: { params: Params }) {
    const data = await loadOrderPage((await params).code);
    return <OrderDetails {...data} />;
}
