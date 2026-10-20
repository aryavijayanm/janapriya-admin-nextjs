import { notFound } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { getOrderByCode } from "@/server/services/order.service";
import { listServiceOptions } from "@/server/services/service.service";
import { orderCodeSchema } from "@/server/validators/order";
import OrderForm from "@/features/order/orderForm";

type Params = Promise<{ code: string }>;

export default async function EditOrderPage({ params }: { params: Params }) {
    const { db, user } = await requireUser();

    // A malformed code, a missing order, or one hidden from this user all 404.
    const code = orderCodeSchema.safeParse((await params).code);
    if (!code.success) notFound();
    const order = await getOrderByCode(db, user, code.data);
    if (!order) notFound();

    // Active services plus any already on this order (shown "(disabled)").
    const linkedIds = order.services.map((link) => link.serviceId);
    const services = await listServiceOptions(db, user, linkedIds);

    return (
        <div className="container mx-auto">
            <OrderForm
                order={{
                    id: order.id,
                    code: order.code,
                    customer: {
                        id: order.customer.id,
                        name: order.customer.name,
                        contactNumber1: order.customer.contactNumber1,
                        address: order.customer.address,
                    },
                    branch: order.branch,
                    serviceIds: linkedIds,
                    remarks: order.remarks,
                }}
                services={services}
                // Only OWNER and STAFF may change the branch.
                canChooseBranch={user.role !== "OUTSIDER"}
            />
        </div>
    );
}
