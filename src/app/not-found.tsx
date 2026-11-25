import type { Metadata } from "next";
import Link from "next/link";
import { LayoutDashboard } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CryingFace } from "@/components/ui/CryingFace";

// One "page not found" for the whole app. Next.js shows it for:
//   - a page calling notFound() (an old order code, a customer id that
//     doesn't exist -- 14 pages do this), and
//   - any URL that matches no page at all.
//
// It sits at the app root, so it renders inside the root layout (font,
// styles) but outside the logged-in layout, which is why it paints its own
// background. Next.js 16 sends this file along with every page, so it stays
// a Server Component -- plain <Link>s, CSS animations, no client JavaScript.
export const metadata: Metadata = {
    title: "Page not found · Janapriya Admin",
};

export default function NotFound() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-app px-4 py-8">
            <Card variant="page" width="4xl" className="motion-safe:animate-modal-in">
                <div className="flex flex-col items-center gap-4 py-4 text-center">
                    <CryingFace className="h-28 w-28" />

                    {/* The big number in the logo's pink -> purple. */}
                    <p className="bg-linear-to-r from-primary to-primary-end bg-clip-text text-7xl font-extrabold leading-none tracking-tight text-transparent sm:text-8xl">
                        404
                    </p>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold text-gray-800">Oh no! This page is not here.</h1>
                        <p className="mx-auto max-w-md text-gray-600">
                            The link may be old, or there may be a small mistake in the address. Let&apos;s get you
                            back.
                        </p>
                    </div>

                    <Link href="/dashboard" className={buttonClasses({ size: "lg", className: "mt-2" })}>
                        <LayoutDashboard className="h-5 w-5" />
                        Go to dashboard
                    </Link>
                </div>
            </Card>
        </main>
    );
}
