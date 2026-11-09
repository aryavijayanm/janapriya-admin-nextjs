import "server-only";

import { revalidatePath } from "next/cache";

/**
 * The pages that show stored staff balances (the list and the dashboard
 * card). Called by every action that refreshes a balance -- staff account
 * changes and order (duty/contract) changes -- so both stay in step.
 */
export function refreshBalancePages() {
    revalidatePath("/staff/balances");
    revalidatePath("/dashboard");
}
