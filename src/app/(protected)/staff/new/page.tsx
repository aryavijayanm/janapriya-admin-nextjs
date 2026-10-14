import { requireUser } from "@/app/_lib/session";
import { listServiceOptions } from "@/server/services/service.service";
import StaffForm from "@/features/staff/staffForm";

// The services list used to come from ServicesContext, fetched in the browser
// after load ("Loading services..."). Now it arrives with the page.
export default async function NewStaffPage() {
    const { db, user } = await requireUser();
    const services = await listServiceOptions(db, user, []);

    return (
        <div className="container mx-auto">
            <StaffForm services={services} />
        </div>
    );
}
