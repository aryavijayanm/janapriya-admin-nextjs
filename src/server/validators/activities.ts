import { z } from "zod";

// The activities page's URL (?day=2026-11-15&tab=staff). Shared by the server
// (page) and the browser (tabs, day buttons). Nonsense values fall back to
// the defaults instead of crashing the page.

export const ACTIVITY_TABS = ["orders", "staff", "money"] as const;
export type ActivityTab = (typeof ACTIVITY_TABS)[number];

export const ACTIVITY_TAB_LABELS: Record<ActivityTab, string> = {
    orders: "Order activities",
    staff: "Staffs activities",
    money: "Money transactions",
};

export const activitiesQuerySchema = z.object({
    /** Missing or nonsense = today. Any day is allowed, future included. */
    day: z.iso.date().optional().catch(undefined),
    tab: z.enum(ACTIVITY_TABS).catch("orders"),
});
