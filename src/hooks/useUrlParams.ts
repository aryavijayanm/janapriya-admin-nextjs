"use client";

import { startTransition, useCallback, useMemo, useOptimistic } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/** key -> new value. null or "" removes the key from the URL (back to its default). */
export type UrlParamChanges = Record<string, string | null>;

interface SetParamsOptions {
    /** Scroll to the top after the change (Next.js default: true). */
    scroll?: boolean;
}

/**
 * The ONE way lists change their URL: filters, search, sort, page number.
 * Before this, usePagination, useSort and several table components each built
 * the new URL by hand with the same lines.
 *
 *   setParams({ status: "PARTLY_PAID" })   -> ?status=PARTLY_PAID   (back to page 1)
 *   setParams({ search: null })            -> removes ?search
 *   setParams({ page: "3" })               -> page 3, filters kept
 *
 * Pending feedback, the Next.js 16 way (docs: "Interactive apps -> Filter with
 * pending feedback"): a URL change makes the server render the list again,
 * and until that arrives the page still shows the old rows. So the change
 * runs inside a transition, and two useOptimistic values cover the wait:
 *   - isPending: true until the new rows arrive (the table dims meanwhile)
 *   - searchParams: already the NEW values, so the filter just clicked shows
 *     as selected straight away instead of after the data loads
 * Both fall back to the real values by themselves when the transition ends.
 */
export function useUrlParams() {
    const router = useRouter();
    const realParams = useSearchParams();
    const [query, setOptimisticQuery] = useOptimistic(realParams.toString());
    const [isPending, setIsPending] = useOptimistic(false);

    const searchParams = useMemo(() => new URLSearchParams(query), [query]);

    const setParams = useCallback(
        (changes: UrlParamChanges, { scroll = true }: SetParamsOptions = {}) => {
            // Start from the optimistic values, so two quick clicks both count.
            const next = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(changes)) {
                if (value === null || value === "") next.delete(key);
                else next.set(key, value);
            }
            // A different filter or sort is a different list: the old page
            // number means nothing in it. Changing the page itself keeps it.
            if (!("page" in changes)) next.delete("page");

            const nextQuery = next.toString();
            startTransition(() => {
                setOptimisticQuery(nextQuery);
                setIsPending(true);
                router.push(`?${nextQuery}`, { scroll });
            });
        },
        [searchParams, router, setOptimisticQuery, setIsPending],
    );

    /** A URL value that must be one of `options` -- anything else (a hand-edited URL) reads as `fallback`. */
    const getOption = useCallback(
        <T extends string>(key: string, options: readonly T[], fallback: T): T => {
            const value = searchParams.get(key);
            return value !== null && (options as readonly string[]).includes(value) ? (value as T) : fallback;
        },
        [searchParams],
    );

    return { searchParams, setParams, getOption, isPending };
}
