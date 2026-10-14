// Next.js runs register() ONCE, when the server starts, before it handles any
// request -- the equivalent of the top of the old NestJS main.ts, where this
// same line lived.
//
// Why: every Date operation on the server ("what is today?", day boundaries,
// logging) uses the server's own timezone. Cloud servers usually run on UTC,
// 5.5 hours behind Kerala, so between 6:30pm and midnight UTC the server
// would think it's still "yesterday" in Kerala. Pinning the zone here means
// the server behaves as Kerala time everywhere, with no per-call timezone
// argument needed -- the project-wide rule (see CLAUDE.md).
//
// Set in code rather than in .env: .env is gitignored, so production would
// only get it if someone remembered to configure it on the host.
//
// What the browser shows is handled separately by src/lib/date.ts -- a web
// page can't change the visitor's own timezone.
export function register() {
    // register() also runs for the "edge" runtime, which has no real process
    // timezone to change. Only the Node.js server needs it.
    if (process.env.NEXT_RUNTIME === "nodejs") {
        process.env.TZ = "Asia/Kolkata";
        // One line in the server terminal at start-up, so you can see it took effect.
        console.info(
            `Server timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone} (Kerala)`,
        );
    }
}
