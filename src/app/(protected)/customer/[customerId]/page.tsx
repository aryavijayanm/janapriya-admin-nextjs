import { notFound } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { getCustomer } from "@/server/services/customer.service";
import { listOrdersForCustomer } from "@/server/services/order.service";
import { customerIdSchema } from "@/server/validators/customer";
import CustomerDetails from "@/features/customer/customerDetails";

type Params = Promise<{ customerId: string }>;

export default async function CustomerDetailsPage({ params }: { params: Params }) {
    const { db, user } = await requireUser();

    // "/customer/abc" or "/customer/-1" -> 404, rather than a database error.
    const id = customerIdSchema.safeParse(Number((await params).customerId));
    if (!id.success) notFound();

    const customer = await getCustomer(db, user, id.data);
    if (!customer) notFound();

    // Only the orders this user may see (OUTSIDER: no OUTSIDE orders).
    const orders = await listOrdersForCustomer(db, user, customer.id);

    return <CustomerDetails customer={customer} orders={orders} />;
}
