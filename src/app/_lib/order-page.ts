import "server-only";

import { notFound } from "next/navigation";
import { requireUser } from "@/app/_lib/session";
import { getOrderByCode } from "@/server/services/order.service";
import { todayInKerala } from "@/server/domain/age";
import { nextContractOpensOn, notCountedDays } from "@/server/domain/contract-dates";
import { fromIsoDate } from "@/server/domain/days";
import { findCoverageGaps } from "@/server/domain/duty";
import { orderCodeSchema } from "@/server/validators/order";

/**
 * Everything an order screen needs, worked out on the server from the domain
 * rules (presentation code may not import server/domain itself). Shared by the
 * order page and its "all contracts" / "all staff duty" pages, so all three
 * always show the same numbers:
 *   gaps         -- days with no staff, and whether each was someone's leave
 *   nextContract -- whether "Start next contract" is open yet, and from when
 *   leaveDays    -- per contract id, days not counted (no paid staff)
 *   today        -- Kerala's date, for the dialogs' date boxes
 *
 * The whole history is loaded even when a page shows only part of it: gaps and
 * leave days need every duty period, and even a years-long order is small.
 * A malformed code, a missing order, or one hidden from this user all 404.
 */
export async function loadOrderPage(rawCode: string) {
    const { db, user } = await requireUser();

    const code = orderCodeSchema.safeParse(rawCode);
    if (!code.success) notFound();
    const order = await getOrderByCode(db, user, code.data);
    if (!order) notFound();

    const gaps = order.contracts.length > 0 ? findCoverageGaps(order.duties) : [];

    const latest = order.contracts.at(-1);
    const nextContract = latest?.endDate
        ? {
            opensOn: nextContractOpensOn(latest.endDate),
            // The new contract copies the latest one's money; both are editable.
            defaultRate: latest.rate,
            defaultStaffSalary: latest.staffSalary,
        }
        : null;

    const today = todayInKerala();
    const leaveDays: Record<number, number | null> = Object.fromEntries(
        order.contracts.map((c) => [c.id, notCountedDays(c, fromIsoDate(today))]),
    );

    return { order, gaps, nextContract, leaveDays, today };
}

/** ?page=2 -> 2; anything odd -> 1 (latestPage() then clamps it to the last page). */
export function pageParam(value: string | string[] | undefined): number {
    const n = Number(Array.isArray(value) ? value[0] : value);
    return Number.isInteger(n) && n >= 1 ? n : 1;
}
