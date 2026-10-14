import { redirect } from "next/navigation";

// The old app did this in the browser: render a spinner, wait for "am I
// logged in?", then router.push. Here it's a server-side redirect that
// happens before any HTML is sent -- no spinner, no flash.
//
// It always goes to /dashboard; the protected layout there is the single
// place that decides "no session -> /login". Checking the session here too
// would duplicate that rule.
export default function Home() {
    redirect("/dashboard");
}
