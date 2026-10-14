import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertValidKey, type FileStore, type SaveFileInput } from "./FileStore";

// Deliberately NOT inside public/. Anything in public/ is served to the
// entire internet with no authentication, and these are staff photos --
// personal data. Files land in a gitignored directory and are served by an
// authenticated Route Handler instead.
//
// turbopackIgnore: when building for deployment, Next.js copies every file it
// sees the server reading. Left alone, this line made it copy the WHOLE project
// -- including this folder of staff photos -- into the server bundle. The
// uploads folder must never ship (LocalFileStore is for development; production
// photos live in Cloudflare R2), so the bundler is told to leave it out.
const UPLOADS_ROOT = path.join(/*turbopackIgnore: true*/ process.cwd(), ".uploads");

export class LocalFileStore implements FileStore {
    private pathFor(key: string): string {
        assertValidKey(key);
        const fullPath = path.resolve(UPLOADS_ROOT, key);

        // Defence in depth. assertValidKey should already have rejected
        // anything dangerous, but path traversal is cheap to double-check and
        // expensive to get wrong, so the resolved path is confirmed to still
        // sit inside the uploads root.
        if (fullPath !== UPLOADS_ROOT && !fullPath.startsWith(UPLOADS_ROOT + path.sep)) {
            throw new Error(`Storage key escapes the uploads directory: ${key}`);
        }
        return fullPath;
    }

    async save({ key, body }: SaveFileInput): Promise<void> {
        const fullPath = this.pathFor(key);
        await mkdir(path.dirname(fullPath), { recursive: true });
        await writeFile(fullPath, body);
    }

    async delete(key: string): Promise<void> {
        try {
            await unlink(this.pathFor(key));
        } catch (error) {
            // Already gone is success, not failure -- delete must be
            // idempotent so a retried request cannot fail on the second run.
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
    }

    async getUrl(key: string): Promise<string> {
        assertValidKey(key);
        // An authenticated Route Handler, not a static path -- so permission
        // is checked before any byte is served. R2FileStore would return a
        // short-lived signed URL here instead.
        return `/api/files/${key}`;
    }

    /**
     * Not part of the FileStore interface: only the local Route Handler needs
     * to stream bytes back through the app. An object store serves its own
     * files directly from a signed URL and never calls anything like this.
     */
    async read(key: string): Promise<Buffer | null> {
        try {
            return await readFile(this.pathFor(key));
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
            throw error;
        }
    }
}
