"use client"; // Next.js: error boundaries must be Client Components

import "./globals.css";
import { errorDigest } from "@/lib/errorDigest";

// The last resort: shown only if the ROOT layout itself crashes, when even
// (protected)/error.tsx can't render. Next.js 16 rules for this file:
//   - it replaces the root layout, so it must render its own <html> and <body>
//     and import the global styles itself;
//   - no `metadata` export, so the tab title is a React <title>;
//   - `retry()` fetches the page again from the server.
//
// Deliberately self-contained: no shared components, no fonts, no icons.
// Whatever broke may be one of those, and this page must still show.
// Light colours set explicitly -- the app has no dark mode.
export default function GlobalError({ error, retry }: { error: unknown; retry: () => void }) {
    const digest = errorDigest(error);

    return (
        <html lang="en" style={{ colorScheme: "light" }}>
            <body className="flex min-h-screen items-center justify-center bg-gray-100 px-4 font-sans text-gray-900 antialiased">
                <title>Something went wrong · Janapriya Admin</title>
                <main className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-md">
                    <h1 className="text-2xl font-bold text-gray-800">Something went wrong</h1>
                    <p className="mt-2 text-gray-600">The app couldn&apos;t load. Please try again in a moment.</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        <button
                            type="button"
                            onClick={() => retry()}
                            className="rounded-lg bg-primary px-4 py-2 font-medium text-white shadow-sm hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                        >
                            Try again
                        </button>
                        {/* A plain <a>, not <Link>: a full page load starts the app fresh. */}
                        <a
                            href="/dashboard"
                            className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-800 shadow-sm hover:bg-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                        >
                            Go to dashboard
                        </a>
                    </div>
                    {digest && <p className="mt-4 font-mono text-xs text-gray-400">Reference: {digest}</p>}
                </main>
            </body>
        </html>
    );
}
