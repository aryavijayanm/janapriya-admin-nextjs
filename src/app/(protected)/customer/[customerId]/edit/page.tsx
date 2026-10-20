import { notFound } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { getCustomer } from "@/server/services/customer.service";
import { customerIdSchema } from "@/server/validators/customer";
import CustomerForm from "@/features/customer/customerForm";

type Params = Promise<{ customerId: string }>;

export default async function EditCustomerPage({ params }: { params: Params }) {
    const { db, user } = await requireUser();

    const id = customerIdSchema.safeParse(Number((await params).customerId));
    if (!id.success) notFound();

    const customer = await getCustomer(db, user, id.data);
    if (!customer) notFound();

    return (
        <div className="container mx-auto">
            <CustomerForm customer={customer} />
        </div>
    );
}
