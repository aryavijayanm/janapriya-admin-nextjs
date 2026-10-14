"use client";

import { useState } from "react";
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

    return (
        <div className="min-h-screen bg-gray-50 flex">
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
                    "lg:static lg:translate-x-0",
                    expanded ? "lg:w-56" : "lg:w-20",
                )}
            >
                <Sidebar user={user} isOpen={expanded} />
            </div>

            {/* Main Content */}
            <div className="relative flex-1 bg-gray-200 flex flex-col min-w-0 transition-all duration-300 ease-in-out">
                <PanicLogout />
                <Navbar user={user} onToggleSidebar={toggleSidebar} />
                <main className="flex-1 p-4 lg:p-8 overflow-y-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
