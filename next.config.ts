import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    experimental: {
        serverActions: {
            // Server Actions reject request bodies over 1 MB by default, and a
            // phone photo is typically 3-5 MB. The photo is shrunk to ~100-300 KB
            // on the server (see server/services/staff-photo.ts), but the raw
            // upload has to get through first. Matches MAX_UPLOAD_BYTES there.
            //
            // Lives under `experimental` in Next 16 -- verified against the
            // installed type definitions; at the top level it is silently ignored.
            bodySizeLimit: "10mb",
        },
    },
};

export default nextConfig;
