// Prisma's `mode: "insensitive"` is implemented with Postgres's ILIKE, which is
// a PATTERN match: inside the pattern, `_` means "any one character" and `%`
// means "anything". So an unescaped lookup for "Baby_Care" matches
// "Baby Care", and a search for "%" matches every row. (Verified against the
// real database, not assumed.)
//
// Escaping makes those characters mean themselves. Backslash is ILIKE's
// default escape character, so it's escaped too.
//
// Use for EVERY user-typed value passed to equals/contains/startsWith with
// mode "insensitive": duplicate-name checks now, staff search next.
export function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, (char) => "\\" + char);
}
