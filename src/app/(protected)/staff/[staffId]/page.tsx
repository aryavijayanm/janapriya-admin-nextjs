import { notFound } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { getStaff, getStaffPhotoUrl } from "@/server/services/staff.service";
import { staffIdSchema } from "@/server/validators/staff";
import StaffDetails from "@/features/staff/staffDetails";

type Params = Promise<{ staffId: string }>;

export default async function StaffDetailsPage({ params }: { params: Params }) {
    const { db, user } = await requireUser();

    // "/staff/abc" or "/staff/-1" -> 404, rather than a database error.
    const id = staffIdSchema.safeParse(Number((await params).staffId));
    if (!id.success) notFound();

    const staff = await getStaff(db, user, id.data);
    if (!staff) notFound();

    // Resolved here, on the server: the browser gets a ready-to-use URL and
    // never needs to know where photos are stored.
    const photoUrl = await getStaffPhotoUrl(staff.photoKey);

    return <StaffDetails staff={staff} photoUrl={photoUrl} />;
}
