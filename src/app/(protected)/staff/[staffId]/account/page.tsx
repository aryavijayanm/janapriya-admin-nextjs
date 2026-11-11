import { notFound } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { pageParam } from "@/app/_lib/order-page";
import { getStaffAccount } from "@/server/services/staff-account.service";
import { getStaff, getStaffPhotoUrl } from "@/server/services/staff.service";
import { staffIdSchema } from "@/server/validators/staff";
import { StaffAccount } from "@/features/staff/StaffAccount";
import { StaffHeader } from "@/features/staff/StaffHeader";

type Params = Promise<{ staffId: string }>;
type SearchParams = Promise<{ page?: string | string[] }>;

// The staff account (View Account on the staff page). Thin: the service works
// out earnings, entries and clearings; ?page=2 shows older clearings. The
// header is the same one as the profile page (same staff + photo look-ups).
export default async function StaffAccountPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    const { db, user } = await requireUser();

    const id = staffIdSchema.safeParse(Number((await params).staffId));
    if (!id.success) notFound();

    const [account, staff] = await Promise.all([
        getStaffAccount(db, user, id.data, pageParam((await searchParams).page)),
        getStaff(db, user, id.data),
    ]);
    if (!account || !staff) notFound();
    const photoUrl = await getStaffPhotoUrl(staff.photoKey);

    return <StaffAccount account={account} header={<StaffHeader staff={staff} photoUrl={photoUrl} current="account" />} />;
}
