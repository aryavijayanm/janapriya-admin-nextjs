import { notFound } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { getStaff, getStaffPhotoUrl } from "@/server/services/staff.service";
import { listServiceOptions } from "@/server/services/service.service";
import { staffIdSchema } from "@/server/validators/staff";
import StaffForm from "@/features/staff/staffForm";

type Params = Promise<{ staffId: string }>;

export default async function EditStaffPage({ params }: { params: Params }) {
    const { db, user } = await requireUser();

    const id = staffIdSchema.safeParse(Number((await params).staffId));
    if (!id.success) notFound();

    const staff = await getStaff(db, user, id.data);
    if (!staff) notFound();

    // Active services PLUS any this staff member is already linked to, even if
    // that service has since been disabled -- otherwise saving the form would
    // silently drop those links (the old project's bug).
    const linkedIds = staff.services.map((link) => link.serviceId);
    const [services, photoUrl] = await Promise.all([
        listServiceOptions(db, user, linkedIds),
        getStaffPhotoUrl(staff.photoKey),
    ]);

    return (
        <div className="container mx-auto">
            <StaffForm staff={staff} services={services} photoUrl={photoUrl} />
        </div>
    );
}
