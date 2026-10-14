import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/_lib/session";
import { LoginForm } from "@/features/auth/LoginForm";

// Thin page, same pattern as the old app: the route file stays small and the
// real UI lives in features/.
//
// Already logged in? Go straight to the dashboard. The old page did this in
// the browser after a "who am I?" request, so the form flashed briefly first;
// on the server the redirect happens before any HTML is sent.
export default async function LoginPage() {
    if (await getCurrentUser()) redirect("/dashboard");
    return <LoginForm />;
}
