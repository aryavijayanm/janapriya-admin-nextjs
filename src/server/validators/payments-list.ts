import { z } from "zod";
import { BRANCHES } from "./order";

// The payments table's URL (?status=NOT_PAID&branch=KERALA&search=rama&page=2).
// Shared by the server (page + service) and the browser (filter buttons). The
// URL is user-editable, so a nonsense value falls back to the default instead
// of crashing the page -- same as the other lists.

/**
 * all         -- every running order, plus ended orders still owing (and, for
 *                the Owner, ended orders with a refund to give)
 * NOT_PAID    -- orders with a contract not paid at all
 * PARTLY_PAID -- orders with a contract partly paid
 * FULLY_PAID  -- running orders with everything paid (shows the latest contract)
 * REFUND      -- Owner only: ended orders with money to give back
 */
export const PAYMENTS_FILTERS = ["all", "NOT_PAID", "PARTLY_PAID", "FULLY_PAID", "REFUND"] as const;
export type PaymentsFilter = (typeof PAYMENTS_FILTERS)[number];

export const PAYMENTS_FILTER_LABELS: Record<PaymentsFilter, string> = {
    all: "All",
    NOT_PAID: "Not paid",
    PARTLY_PAID: "Partly paid",
    FULLY_PAID: "Fully paid",
    REFUND: "Refund to give",
};

export const paymentsListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).catch(1),
    status: z.enum(PAYMENTS_FILTERS).catch("all"),
    branch: z.enum(BRANCHES).optional().catch(undefined),
    search: z.string().trim().max(100).optional().catch(undefined),
});

export type PaymentsListQuery = z.infer<typeof paymentsListQuerySchema>;
