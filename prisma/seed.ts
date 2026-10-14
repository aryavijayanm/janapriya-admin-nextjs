// Standalone CLI script, run via `npx prisma db seed` (wired in
// prisma.config.ts). It deliberately builds its own PrismaClient rather than
// importing src/server/db/client.ts: that module carries a `server-only`
// guard, which throws outside Next.js's react-server condition.

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// The eight services the business actually offers. Abbreviations are shown
// in the staff table (where full names would not fit) and as the service
// filter labels; full names are used everywhere else.
const SERVICES = [
    { name: "Baby Care", abbreviation: "BC" },
    { name: "Delivery Care", abbreviation: "DC" },
    { name: "Hospital Bystander", abbreviation: "HB" },
    { name: "House Maid", abbreviation: "HM" },
    { name: "Nurse Visit", abbreviation: "NV" },
    { name: "Patient Care-Female", abbreviation: "PCF" },
    { name: "Patient Care-Male", abbreviation: "PCM" },
    { name: "Physiotherapy", abbreviation: "PY" },
];

async function main() {
    // Node 20.12+ built-in, so no dotenv dependency: the Prisma CLI does not
    // guarantee it has exported .env into this child process's environment.
    if (!process.env.DATABASE_URL) {
        process.loadEnvFile();
    }

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error("DATABASE_URL is not set (checked environment and .env)");
    }

    const prisma = new PrismaClient({
        adapter: new PrismaPg({ connectionString }),
    });

    try {
        // upsert, not create -- so re-running the seed is harmless and will
        // correct an abbreviation that was edited by hand.
        for (const service of SERVICES) {
            await prisma.service.upsert({
                where: { name: service.name },
                update: { abbreviation: service.abbreviation },
                create: service,
            });
        }
        console.log(`Seeded ${SERVICES.length} services.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
});
