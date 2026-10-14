import { requireUser } from "@/app/_lib/session";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// Replaces the old client-side layout, which rendered a spinner, asked the
// API "am I logged in?", then pushed to /login. Here the check runs on the
// server before anything is sent: no spinner, no flash of protected content.
//
// IMPORTANT -- this check is for the page shell, NOT the security boundary.
// Next.js keeps layouts mounted while you navigate between pages beneath
// them, so this layout does not re-run on every click. A page's data must be
// protected where it's fetched: each service checks the user it is given
// (assertRole). That's why authorization lives in services, not here.
export default async function ProtectedLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const { user } = await requireUser();
    return <DashboardLayout user={user}>{children}</DashboardLayout>;
}
