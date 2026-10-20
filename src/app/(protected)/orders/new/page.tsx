import Link from "next/link";
import { requireUser } from "@/app/_lib/session";
import { getCustomer } from "@/server/services/customer.service";
import { listServiceOptions } from "@/server/services/service.service";
import { customerIdSchema } from "@/server/validators/customer";
import { Alert } from "@/components/ui/Alert";
import OrderForm from "@/features/order/orderForm";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

// Two ways in:
//   /orders/new?customerId=42  -- from a customer's page, or "Save & create order"
//   /orders/new                -- from the sidebar: the form asks "which customer?"
export default async function NewOrderPage({ searchParams }: { searchParams: SearchParams }) {
    const { db, user } = await requireUser();

    const rawId = (await searchParams).customerId;
    const parsedId = customerIdSchema.safeParse(Number(Array.isArray(rawId) ? rawId[0] : rawId));
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

    return (
        <div className="container mx-auto">
            <OrderForm
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
