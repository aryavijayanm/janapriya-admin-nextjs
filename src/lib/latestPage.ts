/**
 * One page of a list, counted from the END (newest), but kept in the list's
 * own oldest-to-newest order. Used for an order's contracts and duty periods.
 *
 *   10 items, size 5:  page 1 -> 6,7,8,9,10   page 2 -> 1,2,3,4,5
 *   30 items, size 25: page 1 -> 6 ... 30     page 2 -> 1 ... 5
 *
 * `items` must already be oldest first. A page past the end shows the last one.
 */
export function latestPage<T>(items: T[], size: number, page = 1) {
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const current = Math.min(Math.max(1, page), totalPages);
    const end = total - (current - 1) * size;
    const start = Math.max(0, end - size);
    return { items: items.slice(start, end), page: current, totalPages, total };
}
