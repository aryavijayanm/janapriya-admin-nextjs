"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { PanicLogout } from "@/features/auth/PanicLogout";
import type { AuthUser } from "@/server/services/authz";
import { Sidebar } from "./Sidebar";
import { Navbar } from "./Navbar";

// `user` arrives as a prop from the protected layout (a Server Component that
// already read the session) -- replacing the old useAuth() context, which had
// to fetch it again in the browser.
export function DashboardLayout({ user, children }: { user: AuthUser; children: React.ReactNode }) {
    // Two pieces of state because the sidebar means two different things:
    //   expanded   -- laptop: full width with labels, or a narrow icon rail
    //   mobileOpen -- phone: a drawer slid in over the page, or hidden
    // Sharing one boolean made the sidebar start open on a phone and sit in
    // the layout permanently, instead of overlaying it.
    const [expanded, setExpanded] = useState(true);
    const [mobileOpen, setMobileOpen] = useState(false);

    const toggleSidebar = () => {
        // Read at click time (not during render), so it's never evaluated on
        // the server and can't cause a hydration mismatch or a first-paint flash.
        const isLaptop = window.matchMedia("(min-width: 1024px)").matches;
        if (isLaptop) {
            setExpanded((value) => !value);
        } else {
            // The drawer is always full width with labels, so make sure a
            // collapsed laptop state can't leak into it.
            setExpanded(true);
            setMobileOpen((value) => !value);
        }
    };

    // Dashboard only: a flat light gray instead of the app gradient. It just
    // overrides the --app-bg variable here; every bg-app box inside (page area,
    // sidebar frame, navbar strip) reads it, so they all change together.
    const isDashboard = usePathname() === "/dashboard";

    return (
        <div className={cn("min-h-screen bg-gray-50 flex", isDashboard && "[--app-bg:var(--color-gray-100)]")}>
            {/* Dimmed backdrop behind the phone drawer; tapping it closes the drawer */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-45 bg-black/50 lg:hidden"
                    onClick={() => setMobileOpen(false)}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar: a fixed drawer below lg, an ordinary column from lg up */}
            <div
                // Event delegation: any link tapped inside closes the drawer,
                // without threading an onNavigate prop through Sidebar/MenuLink.
                onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) setMobileOpen(false);
                }}
                className={cn(
                    "fixed inset-y-0 left-0 z-50 w-56 overflow-hidden transition-all duration-300 ease-in-out",
                    mobileOpen ? "translate-x-0" : "-translate-x-full",
                    // Laptop: sticky and exactly one screen tall, so it stays in view
                    // while the page scrolls. A longer menu scrolls inside the sidebar
                    // (the <aside> in Sidebar.tsx is h-full + overflow-y-auto).
                    "lg:sticky lg:top-0 lg:bottom-auto lg:h-screen lg:self-start lg:translate-x-0",
                    // Laptop: a 4px frame around the sidebar (same background as the main
                    // area), so its four rounded corners show. No right padding: the
                    // navbar strip's own 4px left padding is the gap between them.
                    "lg:bg-app lg:p-1 lg:pr-0",
                    expanded ? "lg:w-56" : "lg:w-20",
                )}
            >
                <Sidebar user={user} isOpen={expanded} />
            </div>

            {/* Main Content */}
            <div className="relative flex-1 bg-app flex flex-col min-w-0 transition-all duration-300 ease-in-out">
                <PanicLogout />
                {/* Sticky strip around the navbar. It's painted with the same app
                    background as the page and has a 4px padding (p-1), so the gap
                    around the navbar is solid -- content scrolling up hides behind it
                    instead of showing through. bg-app is pinned to the screen, so the
                    strip's gradient lines up with the page's exactly. */}
                {/* The same gap on all four sides of the navbar: 8px phone / 12px
                    laptop. Its bottom padding is also the gap down to the page
                    (main has no top padding). Undo: "p-1" here + "p-4 lg:p-8" on main.
                    Change this gap together with main's padding below. */}
                <div className="sticky top-0 z-40 bg-app p-2 lg:p-3">
                    <Navbar user={user} onToggleSidebar={toggleSidebar} />
                </div>
                {/* Same gap as around the navbar (8px phone / 12px laptop) on the
                    sides and bottom, so the page's edges line up with the navbar's.
                    No top padding: the navbar strip's bottom padding is that gap. */}
                <main className="flex-1 px-2 pb-2 lg:px-3 lg:pb-3 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
