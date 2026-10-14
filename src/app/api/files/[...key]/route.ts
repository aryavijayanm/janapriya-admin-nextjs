import { getCurrentUser } from "@/app/_lib/session";
import { LocalFileStore } from "@/server/integrations/storage/LocalFileStore";

// Serves uploaded files (staff photos) from the local .uploads/ folder --
// but only to a logged-in user. This is why photos don't live in public/:
// anything there is readable by anyone on the internet, no login needed.
//
// URL shape: /api/files/staff/3f2a....jpg  ->  key "staff/3f2a....jpg"
// ([...key] collects every path segment after /api/files/).
//
// Development-only in practice: once photos move to Cloudflare R2, the
// FileStore hands the browser a short-lived signed R2 link instead, and this
// route simply goes unused.

const localStore = new LocalFileStore();

const CONTENT_TYPES: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
};

type Params = Promise<{ key: string[] }>;

export async function GET(_request: Request, { params }: { params: Params }) {
    // A plain 401, not a redirect: this is fetched by an <img> tag, not visited.
    if (!(await getCurrentUser())) {
        return new Response("Unauthorized", { status: 401 });
    }

    const key = (await params).key.join("/");

    let bytes: Buffer | null;
    try {
        bytes = await localStore.read(key);
    } catch {
        // A malformed key (e.g. one trying "../" to escape the folder) is
        // rejected by the store; to the caller it's simply not found.
        return new Response("Not found", { status: 404 });
    }
    if (!bytes) return new Response("Not found", { status: 404 });

    const extension = key.split(".").pop()?.toLowerCase() ?? "";
    return new Response(new Uint8Array(bytes), {
        headers: {
            "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
            // "private": only this user's browser may cache it, never a shared
            // proxy. "immutable": a key's content never changes -- a new photo
            // always gets a new random key -- so it's safe to cache for long.
            "Cache-Control": "private, max-age=31536000, immutable",
            // Don't let the browser second-guess the type above.
            "X-Content-Type-Options": "nosniff",
        },
    });
}
