import "server-only";

import { LocalFileStore } from "./LocalFileStore";
import type { FileStore } from "./FileStore";

// The single wiring point. Moving to Cloudflare R2 means adding
// R2FileStore.ts and changing this one line -- no service, action or
// component changes, because they all depend on the FileStore interface
// rather than on a concrete store.
export const fileStore: FileStore = new LocalFileStore();

export type { FileStore, SaveFileInput } from "./FileStore";
