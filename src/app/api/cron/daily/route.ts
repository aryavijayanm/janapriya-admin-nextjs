import { createHash, timingSafeEqual } from "node:crypto";
import { db } from "@/server/db/client";
import { runDailyJobs } from "@/server/jobs/daily";

// POST /api/cron/daily -- the "doorbell" an outside scheduler rings once a day.
//
//   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/daily
//
// SCHEDULE: 00:05 Kerala time. Most schedulers use UTC, and Kerala is UTC+5:30
// (no daylight saving), so the cron line is:
//
//   35 18 * * *        <- 18:35 UTC = 00:05 Kerala, NOT "5 0 * * *" (that's 05:35 Kerala)
//
// Protected by CRON_SECRET (a long random value in .env, never committed):
// without it anyone on the internet could trigger the job. Not a logged-in
// page, so no session check -- the secret IS the check.
//
// In development: `npm run cron:daily` rings it on localhost.

// Node runtime (crypto, Prisma), never cached: every call must really run.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Constant-time comparison: a plain === can return slightly sooner the
 * earlier the strings differ, which an attacker could time to guess the
 * secret letter by letter. Hashing first makes both sides the same length,
 * which timingSafeEqual requires.
 */
function secretMatches(given: string, expected: string): boolean {
    const a = createHash("sha256").update(given).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
}

export async function POST(request: Request) {
    const expected = process.env.CRON_SECRET;
    // Fail closed: a missing or too-short secret must never mean "open to all".
    if (!expected || expected.length < 32) {
        console.error("Cron: CRON_SECRET is missing or shorter than 32 characters -- refusing to run.");
        return Response.json({ error: "Cron is not configured" }, { status: 503 });
    }

    const header = request.headers.get("authorization") ?? "";
    const given = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
    if (!secretMatches(given, expected)) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const startedAt = Date.now();
    try {
        const report = await runDailyJobs(db);
        console.info(`Cron daily: ${JSON.stringify(report)} in ${Date.now() - startedAt} ms`);
        return Response.json(report);
    } catch (error) {
        console.error("Cron daily failed:", error);
        // 500 tells the scheduler it failed (most retry or alert on that).
        return Response.json({ error: "Daily jobs failed" }, { status: 500 });
    }
}
