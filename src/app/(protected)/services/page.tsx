import { redirect } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { listAllServices } from "@/server/services/service.service";
import ServiceTable from "@/features/service/ServiceTable";

// Same shape as /users: gate (UX), fetch, hand data to the feature component.
// The real Owner-only check is assertRole() inside the service, which also
// protects the Server Actions.
export default async function ManageServicesPage() {
    const { db, user } = await requireUser();
    if (user.role !== "OWNER") redirect("/dashboard");

    const services = await listAllServices(db, user);
    return <ServiceTable services={services} />;
}
