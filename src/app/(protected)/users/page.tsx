import { redirect } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { listUsers } from "@/server/services/user.service";
import UserTable from "@/features/user/UserTable";

// Thin page: gate, fetch, hand data to the feature component.
//
// The role check appears twice on purpose, doing two different jobs:
//   here         -> UX: a non-owner who opens /users is sent to the dashboard
//                   (what the old client-side RequireRole did)
//   listUsers()  -> security: assertRole() inside the service, which is also
//                   what protects the Server Actions -- those are public
//                   endpoints that can be called without ever loading this page.
export default async function ManageUsersPage() {
    const { db, user } = await requireUser();
    if (user.role !== "OWNER") redirect("/dashboard");

    const users = await listUsers(db, user);
    return <UserTable users={users} currentUserId={user.id} />;
}
