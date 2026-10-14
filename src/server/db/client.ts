// This guard is enforced by the bundler, not by lint: if any "use client"
// module ends up importing this file, the build fails outright. That is
// stronger than an ESLint rule, which a disable-comment could wave away.
// Note it also means standalone scripts (prisma/seed.ts) must NOT import
// this file -- outside Next's react-server condition, server-only throws.
import "server-only";

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
}

function createClient() {
    // Prisma 7 removed the Rust query engine; a driver adapter supplies the
    // actual Postgres connection instead. Swapping this one line for
    // @prisma/adapter-neon is all that moving to Neon's serverless driver
    // would take.
    const adapter = new PrismaPg({ connectionString });
    return new PrismaClient({ adapter });
}

// Next.js re-evaluates modules on every hot reload in development, which
// would otherwise build a new client -- and a new connection pool -- on each
// edit until Postgres starts refusing connections. Caching on globalThis is
// the one thing that survives HMR.
const globalForPrisma = globalThis as unknown as {
    prisma?: ReturnType<typeof createClient>;
};

export const db = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = db;
}

// Services take this as their first parameter -- `createStaff(db, user, input)`
// -- rather than importing the client themselves. That is what keeps them
// callable from a Server Action, a cron job, a test with a transaction, or a
// NestJS controller after the split, without changing a line.
export type Db = typeof db;
