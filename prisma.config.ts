import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// Prisma 6 loaded .env automatically; Prisma 7 does not. Node's built-in
// loader (20.12+) does the job without a dotenv dependency. Guarded because
// in production there is no .env file -- the host injects real environment
// variables -- and loadEnvFile throws when the file is missing.
if (existsSync(".env")) {
    process.loadEnvFile(".env");
}

// Prisma 7 moved the connection URL out of schema.prisma to here. This file
// is read only by the Prisma CLI (migrate, db seed, introspect) -- the
// application itself never loads it; the running app connects through the
// driver adapter in src/server/db/client.ts instead.
export default defineConfig({
    schema: "prisma/schema.prisma",
    datasource: {
        url: env("DATABASE_URL"),
    },
    migrations: {
        // Replaces the old package.json "prisma": { "seed": ... } field.
        seed: "tsx prisma/seed.ts",
    },
});
