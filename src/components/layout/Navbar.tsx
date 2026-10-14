"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing, Calendar1, Menu, Power, Search } from "lucide-react";
import { CalendarPanel } from "@/features/calendar/CalendarPanel";
import { logoutAction } from "@/features/auth/auth.actions";
import type { AuthUser } from "@/server/services/authz";

interface NavbarProps {
    user: AuthUser;
    onToggleSidebar: () => void;
}

export function Navbar({ user, onToggleSidebar }: NavbarProps) {
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [staffSearch, setStaffSearch] = useState("");
    const router = useRouter();

    // Navigates to the staff list with this search applied -- a fresh
    // search from the navbar (which can be triggered from any page) starts
    // from a clean slate rather than trying to preserve whatever sort/filter/
    // page happened to be set on whatever page the user was previously on.
    const runStaffSearch = () => {
        const trimmed = staffSearch.trim();
        router.push(trimmed ? `/staff?search=${encodeURIComponent(trimmed)}` : "/staff");
    };

    return (
        <header className="h-16 bg-white border-b border-gray-100 px-4 flex items-center justify-between sticky shadow-lg top-0 z-40">
            <div className="flex items-center gap-4">
                <button
                    onClick={onToggleSidebar}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                    aria-label="Toggle Sidebar"
                >
                    <Menu className="h-6 w-6" />
                </button>

                {/* Search Customer */}
                <div className="hidden md:flex relative items-center">
                    <input
                        type="text"
                        placeholder="Search Customer..."
                        className="pl-4 pr-10 py-2 rounded-2xl bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-600 focus:border-transparent text-sm w-64"
                    />
                    <div className="absolute right-3">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                </div>

                {/* Search Staff */}
                <div className="hidden md:flex relative items-center">
                    <input
                        type="text"
                        placeholder="Search Staff..."
                        value={staffSearch}
                        onChange={(e) => setStaffSearch(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") runStaffSearch();
                        }}
                        className="pl-4 pr-10 py-2 rounded-2xl bg-white border border-gray-300 focus:outline-none focus:ring-1 focus:ring-gray-600 focus:border-transparent text-sm w-64"
                    />
                    <button
                        type="button"
                        onClick={runStaffSearch}
                        aria-label="Search Staff"
                        className="absolute right-3"
                    >
                        <Search className="h-5 w-5 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Right Side Icons & User Info -- tighter gap on phones */}
            <div className="flex items-center gap-4 sm:gap-6">
                {/* Calendar */}
                <button
                    onClick={() => setIsCalendarOpen(true)}
                    className="text-gray-500 hover:text-primary transition-colors"
                    aria-label="Open calendar"
                >
                    <Calendar1 className="h-5 w-5" />
                </button>

                {/* Notifications */}
                <button
                    className="text-gray-500 hover:text-primary transition-colors relative"
                    aria-label="Notifications"
                >
                    <BellRing className="h-5 w-5" />
                    <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full border border-white"></span>
                </button>

                {/* Vertical Divider + User Info: hidden on phones, where there's no room */}
                <div className="hidden sm:block h-8 w-px bg-gray-500 mx-1"></div>
                <div className="hidden sm:flex flex-col items-end mr-2">
                    <span className="text-sm font-bold text-gray-700 leading-tight">{user.name}</span>
                    <span className="text-xs text-gray-500">{user.designation || user.role}</span>
                </div>

                {/* Power Button -- a real form posting to the Server Action, so it
                    works even before the page's JavaScript has loaded. */}
                <form action={logoutAction} className="flex">
                    <button
                        type="submit"
                        className="text-gray-500 hover:text-red-600 transition-colors"
                        title="Logout"
                        aria-label="Logout"
                    >
                        <Power className="h-5 w-5" />
                    </button>
                </form>
            </div>

            <CalendarPanel
                isOpen={isCalendarOpen}
                onClose={() => setIsCalendarOpen(false)}
            />
        </header>
    );
}
