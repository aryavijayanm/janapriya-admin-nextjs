import "server-only";

import type { Db } from "@/server/db/client";
import { startDueContracts } from "@/server/services/order.service";
import { refreshAllStaffBalances } from "@/server/services/staff-balance.service";

// The nightly jobs, run once a day at 02:00 Kerala time. Jobs only call
// services (the architecture rule) -- all the real rules live there.
//
// WHO RUNS THIS: nothing inside the app keeps time. An outside scheduler
// (Linux crontab, Railway Cron, Cloudflare Cron, GitHub Actions, Vercel Cron,
// a hosted scheduler...) calls POST /api/cron/daily, which calls this.
// Choosing a host later only changes that scheduler, never this file.
//
// Safe to run more than once a day, and catches up after a missed night:
// every step only does what is due.
//
// Later steps add here, e.g. "queue tomorrow's customer reminders" (rows
// only -- the messages are SENT at a friendlier hour by a separate step).

export interface DailyJobsReport {
    contractsCreated: number;
    staffBalancesChecked: number;
    staffBalancesChanged: number;
}

export async function runDailyJobs(db: Db): Promise<DailyJobsReport> {
    // 1. Create due contracts FIRST: a new contract can move days to a new
    //    staff salary, and step 2 should see that.
    const { created } = await startDueContracts(db);
    // 2. Refresh every staff member's stored balance (the balances look-up):
    //    yesterday's day for staff on duty, and heals any refresh a save missed.
    const balances = await refreshAllStaffBalances(db);
    return {
        contractsCreated: created,
        staffBalancesChecked: balances.checked,
        staffBalancesChanged: balances.changed,
    };
}
