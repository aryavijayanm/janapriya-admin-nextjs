import { redirect } from "next/navigation";
import { getCurrentUser } from "@/app/_lib/session";
import { LoginForm } from "@/features/auth/LoginForm";
import { LoginBackdrop } from "@/features/auth/LoginBackdrop";

// Thin page, same pattern as the old app: the route file stays small and the
// real UI lives in features/.
//
// Already logged in? Go straight to the dashboard. The old page did this in
// the browser after a "who am I?" request, so the form flashed briefly first;
// on the server the redirect happens before any HTML is sent.
export default async function LoginPage() {
    if (await getCurrentUser()) redirect("/dashboard");
    // App gradient + soft colour glows behind the glass login box.
    return (
        <div className="relative min-h-screen overflow-hidden bg-app">
            <LoginBackdrop />
            <LoginForm />
        </div>
    );
}
