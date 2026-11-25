"use client"; // Next.js: error boundaries must be Client Components

import { useEffect } from "react";
import Link from "next/link";
import { LayoutDashboard, RotateCw, TriangleAlert } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/Button";
import { StatusPanel } from "@/components/ui/StatusPanel";
import { errorDigest } from "@/lib/errorDigest";

// Shown when a logged-in page fails unexpectedly (database down, a bug).
// Expected problems ("Please pay contract #1 first") never land here -- the
// services return those as messages inside the form.
//
// It lives in (protected)/, and an error.tsx wraps only the pages BELOW its
// own layout, so the sidebar and navbar stay on screen around this panel.
//
// Next.js 16: `retry()` (added in 16.2) fetches the page again from the
// server and re-renders it -- what "Try again" should do. The older `reset()`
// only re-renders what is already in the browser, which would fail the same way.
//
// In production Next.js never sends the real error text to the browser, only
// a short `digest`; it's shown as the reference, matching the server log.
export default function ProtectedError({ error, retry }: { error: unknown; retry: () => void }) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    const digest = errorDigest(error);

    return (
        <StatusPanel
            icon={<TriangleAlert className="w-7 h-7" />}
            title="Something went wrong"
            message="The page couldn't load. Try again, or go back to the dashboard."
            footnote={digest ? `Reference: ${digest}` : undefined}
        >
            <Button onClick={() => retry()}>
                <RotateCw className="w-4 h-4" />
                Try again
            </Button>
            <Link href="/dashboard" className={buttonClasses({ variant: "secondary" })}>
                <LayoutDashboard className="w-4 h-4" />
                Go to dashboard
            </Link>
        </StatusPanel>
    );
}
