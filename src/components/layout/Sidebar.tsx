"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { BookOpen, Users, ClipboardList, ClipboardPlus, CreditCard, Banknote, LayoutDashboard, UserPlus, UserRoundCog, UserRoundPlus, Wallet, type LucideIcon } from "lucide-react";
import type { AuthUser } from "@/server/services/authz";

interface SidebarProps {
    user: AuthUser;
    isOpen: boolean;
}

interface MenuItem {
    href: string;
    icon: LucideIcon;
    label: string;
    // Leave out = everyone sees it.
    // Hiding OWNER-only links is a convenience, not security: the services
    // behind those pages check the role again with assertRole().
    visible?: (user: AuthUser) => boolean;
}

interface MenuSection {
    title?: string; // no title = no heading (Dashboard)
    items: MenuItem[];
}

const isOwner = (user: AuthUser) => user.role === "OWNER";

// The whole menu in one list. To add a page: add one line here.
const MENU: MenuSection[] = [
    { items: [{ href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" }] },
    {
        title: "Customer",
        items: [
            { href: "/customer/new", icon: UserPlus, label: "Add Customer" },
            { href: "/customer", icon: Users, label: "View Customers" },
        ],
    },
    {
        title: "Orders",
        items: [
            { href: "/orders/new", icon: ClipboardPlus, label: "New Order" },
            { href: "/orders", icon: ClipboardList, label: "View Orders" },
        ],
    },
    {
        title: "Staff",
        items: [
            { href: "/staff/new", icon: UserRoundPlus, label: "Add Staff" },
            { href: "/staff/balances", icon: Wallet, label: "View Staff Balances" },
            { href: "/staff", icon: Users, label: "View All Staff" },
        ],
    },
    {
        title: "Others",
        items: [
            { href: "/payments", icon: CreditCard, label: "Payments" },
            // Everyone except OUTSIDER (the page and service refuse them too).
            { href: "/accounts", icon: BookOpen, label: "Accounts Book", visible: (user) => user.role !== "OUTSIDER" },
            { href: "/services", icon: Banknote, label: "Manage Services", visible: isOwner },
            { href: "/users", icon: UserRoundCog, label: "Manage Users", visible: isOwner },
        ],
    },
];

// Which link to highlight. A link matches its own page AND the pages under it
// (/orders matches /orders/ABC123/duty). When several match, the LONGEST wins:
// on /orders/new both "/orders" and "/orders/new" match -> "New Order" lights up, not both.
function findActiveHref(pathname: string | null, items: MenuItem[]): string | null {
    if (!pathname) return null;
    let best: string | null = null;
    for (const { href } of items) {
        const matches = pathname === href || pathname.startsWith(href + "/");
        if (matches && (!best || href.length > best.length)) best = href;
    }
    return best;
}

export function Sidebar({ user, isOpen }: SidebarProps) {
    const pathname = usePathname();

    // Drop links this user can't see, and sections left empty.
    const sections = MENU
        .map((section) => ({ ...section, items: section.items.filter((item) => !item.visible || item.visible(user)) }))
        .filter((section) => section.items.length > 0);
    const activeHref = findActiveHref(pathname, sections.flatMap((section) => section.items));

    return (
        <aside
            // Phone drawer: only the right-side corners are rounded (the left side is
            // flat against the screen edge). Laptop: it sits in a 4px frame
            // (see DashboardLayout), so all four corners are rounded.
            className={`h-full bg-sidebar-bg text-sidebar-text overflow-y-auto no-scrollbar rounded-r-2xl lg:rounded-2xl`}
        >
            {/* Logo Section - same colour as the sidebar (the logo PNG is transparent) */}
            <div className="h-16 flex items-center justify-center bg-sidebar-bg overflow-hidden">
                {/* The container shrinks, but the inner image stays wide to create the "cut" effect */}
                <div className={`relative h-16 transition-all duration-300 ${isOpen ? "w-40" : "w-14"} overflow-hidden`}>
                    <div className="absolute left-0 top-0 h-full w-40">
                        <Image
                            src="/images/logo_black.png"
                            alt="Janapriya"
                            fill
                            // The image box is always w-40 (160px), even when the sidebar is collapsed.
                            sizes="160px"
                            className="object-contain object-left"
                            priority
                        />
                    </div>
                </div>
            </div>

            {/* Menu Items */}
            <div className="py-4 px-2 space-y-6">
                {sections.map((section, index) => (
                    <div key={section.title ?? index}>
                        {isOpen && section.title && (
                            <h3 className="px-4 text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2 whitespace-nowrap">
                                {section.title}
                            </h3>
                        )}
                        <div className="space-y-1">
                            {section.items.map((item) => (
                                <MenuLink key={item.href} item={item} isOpen={isOpen} isActive={item.href === activeHref} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </aside>
    );
}

// The ONE place the active-item look is defined.
// Pink for the first 70%, then fades into purple at the right edge only.
const ACTIVE_BG = "bg-linear-to-r from-primary from-70% to-primary-end";

function MenuLink({ item: { href, icon: Icon, label }, isOpen, isActive }: { item: MenuItem; isOpen: boolean; isActive: boolean }) {
    return (
        <Link
            href={href}
            className={`flex items-center ${isOpen ? "gap-3 px-4" : "justify-center px-2"
                } py-2 rounded-xl transition-colors text-sm ${isActive
                    ? `${ACTIVE_BG} text-white`
                    // Faint see-through pink: as soft as white/10, but warm.
                    : "hover:bg-primary/20"
                }`}
            title={!isOpen ? label : undefined}
            aria-current={isActive ? "page" : undefined}
        >
            <Icon className="h-4 w-4 shrink-0" />
            {isOpen && <span className="whitespace-nowrap">{label}</span>}
        </Link>
    );
}
