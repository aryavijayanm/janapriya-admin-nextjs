import "server-only";

import type { Db } from "@/server/db/client";
import { startDueContracts } from "@/server/services/order.service";

// The nightly jobs, run once a day at 00:05 Kerala time. Jobs only call
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
}

export async function runDailyJobs(db: Db): Promise<DailyJobsReport> {
    const { created } = await startDueContracts(db);
    return { contractsCreated: created };
}
