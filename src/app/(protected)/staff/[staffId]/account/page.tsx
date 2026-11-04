import { notFound } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { pageParam } from "@/app/_lib/order-page";
import { getStaffAccount } from "@/server/services/staff-account.service";
import { staffIdSchema } from "@/server/validators/staff";
import { StaffAccount } from "@/features/staff/StaffAccount";

type Params = Promise<{ staffId: string }>;
type SearchParams = Promise<{ page?: string | string[] }>;

// The staff account (View Account on the staff page). Thin: the service works
// out earnings, entries and clearings; ?page=2 shows older clearings.
export default async function StaffAccountPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
    const { db, user } = await requireUser();

    const id = staffIdSchema.safeParse(Number((await params).staffId));
    if (!id.success) notFound();

    const account = await getStaffAccount(db, user, id.data, pageParam((await searchParams).page));
    if (!account) notFound();

    return <StaffAccount account={account} />;
}
