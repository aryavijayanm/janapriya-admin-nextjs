import Link from "next/link";
import { requireUser } from "@/app/_lib/session";
import { getCustomer } from "@/server/services/customer.service";
import { listServiceOptions } from "@/server/services/service.service";
import { customerIdSchema } from "@/server/validators/customer";
import { orderCodeSchema } from "@/server/validators/order";
import { getOrderByCode } from "@/server/services/order.service";
import { Alert } from "@/components/ui/Alert";
import OrderForm from "@/features/order/orderForm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// Three ways in:
//   /orders/new?customerId=42     -- from a customer's page, or "Save & create order"
//   /orders/new                   -- from the sidebar: the form asks "which customer?"
//   /orders/new?restartFrom=K7QT  -- "Restart" on an ended order: a new linked order, prefilled
export default async function NewOrderPage({ searchParams }: { searchParams: SearchParams }) {
    const { db, user } = await requireUser();
    const params = await searchParams;

    // Restart: the ended order it continues (its customer, branch, services, remarks).
    const restartCode = orderCodeSchema.safeParse(first(params.restartFrom));
    const restartOrder = restartCode.success ? await getOrderByCode(db, user, restartCode.data) : null;
    if (restartCode.success && (!restartOrder || restartOrder.status !== "ENDED" || restartOrder.restartedAs)) {
        return (
            <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md space-y-4">
                <Alert variant="error">
                    {!restartOrder
                        ? "The order to restart was not found."
                        : restartOrder.restartedAs
                          ? `Order ${restartOrder.code} was already restarted as ${restartOrder.restartedAs.code}.`
                          : `Order ${restartOrder.code} is still running. Only an ended order can be restarted.`}
                </Alert>
                <Link href="/orders" className="text-primary hover:underline">
                    Back to orders
                </Link>
            </div>
        );
    }

    const rawId = restartOrder ? restartOrder.customer.id : first(params.customerId);
    const parsedId = customerIdSchema.safeParse(Number(rawId));
    const customer = parsedId.success ? await getCustomer(db, user, parsedId.data) : null;

    // Arrived for a specific customer who can't take new orders: say why,
    // rather than showing a form that would only fail on saving.
    if (customer && customer.status !== "ACTIVE") {
        return (
            <div className="max-w-4xl mx-auto p-4 sm:p-8 bg-white rounded-lg shadow-md space-y-4">
                <Alert variant="error">
                    {customer.name} is {customer.status === "DISABLED" ? "disabled" : "deleted"}, so a new order
                    can&apos;t be created for them.
                </Alert>
                <Link href={`/customer/${customer.id}`} className="text-primary hover:underline">
                    Back to the customer
                </Link>
            </div>
        );
    }

    const services = await listServiceOptions(db, user, []);
    // A service switched off since then isn't offered to a new order, so it isn't copied.
    const offered = new Set(services.map((s) => s.id));

    return (
        <div className="container mx-auto">
            <OrderForm
                restartFrom={
                    restartOrder
                        ? {
                              code: restartOrder.code,
                              branch: restartOrder.branch,
                              serviceIds: restartOrder.services.map((s) => s.service.id).filter((id) => offered.has(id)),
                              remarks: restartOrder.remarks,
                          }
                        : null
                }
                customer={
                    customer
                        ? { id: customer.id, name: customer.name, contactNumber1: customer.contactNumber1, address: customer.address }
                        : null
                }
                services={services}
                // OUTSIDER: no branch field; their orders are always Kerala.
                canChooseBranch={user.role !== "OUTSIDER"}
            />
        </div>
    );
}
