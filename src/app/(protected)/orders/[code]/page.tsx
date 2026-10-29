import { notFound } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { getOrderByCode } from "@/server/services/order.service";
import { todayInKerala } from "@/server/domain/age";
import { nextContractOpensOn, notCountedDays } from "@/server/domain/contract-dates";
import { fromIsoDate } from "@/server/domain/days";
import { findCoverageGaps } from "@/server/domain/duty";
import { orderCodeSchema } from "@/server/validators/order";
import OrderDetails from "@/features/order/orderDetails";

type Params = Promise<{ code: string }>;

// The order page. Thin: it loads the order, then works out on the server the
// few things the screen needs from the domain rules (presentation code may
// not import server/domain itself):
//   gaps         -- days with no staff, and whether each was someone's leave
//   nextContract -- whether "Start next contract" is open yet, and from when
//   today        -- Kerala's date, as the default in the dialogs' date boxes
export default async function OrderPage({ params }: { params: Params }) {
    const { db, user } = await requireUser();

    // A malformed code, a missing order, or one hidden from this user all 404.
    const code = orderCodeSchema.safeParse((await params).code);
    if (!code.success) notFound();
    const order = await getOrderByCode(db, user, code.data);
    if (!order) notFound();

    const gaps = order.contracts.length > 0 ? findCoverageGaps(order.duties) : [];

    const latest = order.contracts.at(-1);
    const nextContract = latest?.endDate
        ? {
            opensOn: nextContractOpensOn(latest.endDate),
            // The new contract copies the latest one's money; both are editable.
            defaultRate: latest.rate,
            defaultStaffSalary: latest.staffSalary,
        }
        : null;

    // Leave days per contract (days not counted), keyed by contract id.
    const today = todayInKerala();
    const leaveDays = Object.fromEntries(
        order.contracts.map((c) => [c.id, notCountedDays(c, fromIsoDate(today))]),
    );

    return (
        <OrderDetails order={order} gaps={gaps} nextContract={nextContract} leaveDays={leaveDays} today={today} />
    );
}
