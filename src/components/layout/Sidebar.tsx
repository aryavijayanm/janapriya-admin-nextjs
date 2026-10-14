"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Users, CreditCard, Banknote, LayoutDashboard, UserPlus, UserRoundCog, UserRoundPlus, Trash2, ShieldCheck, Eye, type LucideIcon } from "lucide-react";
import type { AuthUser } from "@/server/services/authz";

interface SidebarProps {
    user: AuthUser;
    isOpen: boolean;
}

export function Sidebar({ user, isOpen }: SidebarProps) {
    const pathname = usePathname();
    // Hiding OWNER-only links is a convenience, not security: the services
    // behind those pages check the role again with assertRole().
    const isOwner = user.role === "OWNER";

    return (
        <aside
            className={`h-full bg-sidebar-bg text-sidebar-text overflow-y-auto`}
        >
            {/* Logo Section - Black background */}
            <div className="h-16 flex items-center justify-center bg-black overflow-hidden">
                {/* The container shrinks, but the inner image stays wide to create the "cut" effect */}
                <div className={`relative h-16 transition-all duration-300 ${isOpen ? "w-40" : "w-14"} overflow-hidden`}>
                    <div className="absolute left-0 top-0 h-full w-40">
                        <Image
                            src="/images/logo_black.png"
                            alt="Janapriya"
                            fill
                            className="object-contain object-left"
                            priority
                        />
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="py-4 px-2 space-y-6">

                {/* Dashboard */}
                <div>
                    <Link
                        href="/dashboard"
                        className={`flex items-center ${isOpen ? "gap-3 px-4" : "justify-center px-2"
                            } py-2 rounded-lg transition-colors group ${pathname === "/dashboard"
                                ? "bg-primary text-white"
                                : "hover:bg-primary-hover"
                            }`}
                        title={!isOpen ? "Dashboard" : undefined}
                    >
                        <LayoutDashboard className="h-5 w-5 shrink-0" />
                        {isOpen && <span className="font-medium whitespace-nowrap">Dashboard</span>}
                    </Link>
                </div>

                {/* CUSTOMER */}
                <div>
                    {isOpen && (
                        <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 whitespace-nowrap">
                            Customer
                        </h3>
                    )}
                    <div className="space-y-1">
                        <MenuLink href="/customer/new" icon={UserPlus} label="Add Customer" isOpen={isOpen} pathname={pathname} />
                        <MenuLink href="/customer" icon={Users} label="View Customers" isOpen={isOpen} pathname={pathname} />
                        <MenuLink href="/customer" icon={Eye} label="View All Customers" isOpen={isOpen} pathname={pathname} />
                        <MenuLink href="/customer/delete" icon={Trash2} label="Delete Customer" isOpen={isOpen} pathname={pathname} />
                    </div>
                </div>

                {/* STAFF */}
                <div>
                    {isOpen && (
                        <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 whitespace-nowrap">
                            Staff
                        </h3>
                    )}
                    <div className="space-y-1">
                        <MenuLink href="/staff/new" icon={UserRoundPlus} label="Add Staff" isOpen={isOpen} pathname={pathname} />
                        <MenuLink href="/staff/active" icon={ShieldCheck} label="View Active Staff" isOpen={isOpen} pathname={pathname} />
                        <MenuLink href="/staff" icon={Users} label="View All Staff" isOpen={isOpen} pathname={pathname} />
                    </div>
                </div>

                {/* OTHERS */}
                <div>
                    {isOpen && (
                        <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 whitespace-nowrap">
                            Others
                        </h3>
                    )}
                    <div className="space-y-1">
                        <MenuLink href="/payments" icon={CreditCard} label="View Payment" isOpen={isOpen} pathname={pathname} />
                    </div>

                    <div className="space-y-1">
                        <MenuLink href="/salaries/add" icon={Banknote} label="Add Salary" isOpen={isOpen} pathname={pathname} />
                    </div>

                    {isOwner && (
                        <div className="space-y-1">
                            <MenuLink href="/services" icon={Banknote} label="Manage Services" isOpen={isOpen} pathname={pathname} />
                        </div>
                    )}

                    {isOwner && (
                        <div className="space-y-1">
                            <MenuLink href="/users" icon={UserRoundCog} label="Manage Users" isOpen={isOpen} pathname={pathname} />
                        </div>
                    )}
                </div>

            </div>
        </aside>
    );
}

function MenuLink({ href, icon: Icon, label, isOpen, pathname }: { href: string; icon: LucideIcon; label: string; isOpen: boolean; pathname: string | null }) {
    const isActive = pathname === href;
    return (
        <Link
            href={href}
            className={`flex items-center ${isOpen ? "gap-3 px-4" : "justify-center px-2"
                } py-2 rounded-lg transition-colors text-sm ${isActive
                    ? "bg-primary text-white"
                    : "hover:bg-primary-hover"
                }`}
            title={!isOpen ? label : undefined}
        >
            <Icon className="h-4 w-4 shrink-0" />
            {isOpen && <span className="whitespace-nowrap">{label}</span>}
        </Link>
    );
}
