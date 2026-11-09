import { z } from "zod";

// The staff balances page's URL (?money=owes&duty=off&search=anu&page=2).
// Shared by the server (page + service) and the browser (filter buttons).
// The URL is user-editable, so a nonsense value falls back to the default
// instead of crashing the page -- same as the staff list.

/** all = any non-zero balance; owed = we owe the staff; owes = the staff owes us. */
export const BALANCE_MONEY_FILTERS = ["all", "owed", "owes"] as const;
/** on = has an open duty period now; off = no open duty period. */
export const BALANCE_DUTY_FILTERS = ["all", "on", "off"] as const;

export type BalanceMoneyFilter = (typeof BALANCE_MONEY_FILTERS)[number];
export type BalanceDutyFilter = (typeof BALANCE_DUTY_FILTERS)[number];

export const BALANCE_MONEY_LABELS: Record<BalanceMoneyFilter, string> = {
    all: "All",
    owed: "Amount to staff",
    owes: "Amount from staff",
};

export const BALANCE_DUTY_LABELS: Record<BalanceDutyFilter, string> = {
    all: "All",
    on: "On duty",
    off: "Not on duty",
};

export const staffBalanceQuerySchema = z.object({
    page: z.coerce.number().int().min(1).catch(1),
    money: z.enum(BALANCE_MONEY_FILTERS).catch("all"),
    duty: z.enum(BALANCE_DUTY_FILTERS).catch("all"),
    search: z.string().trim().max(100).optional().catch(undefined),
});

export type StaffBalanceQuery = z.infer<typeof staffBalanceQuerySchema>;
