import { requireUser } from "@/app/_lib/session";
import CustomerForm from "@/features/customer/customerForm";

// No data to load for a new customer -- the session check is all this page does.
export default async function NewCustomerPage() {
    await requireUser();

    return (
        <div className="container mx-auto">
            <CustomerForm />
        </div>
    );
}
