-- Added by hand (Prisma's schema file can't express extensions): switches on
-- PostgreSQL's built-in trigram module, which provides similarity() for the
-- "address is >= 70% similar to an existing customer" duplicate warning.
-- IF NOT EXISTS makes it safe on a database where it's already enabled.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'DISABLED', 'DELETED');

-- CreateTable
CREATE TABLE "Customer" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "contactNumber1" TEXT NOT NULL,
    "contactNumber2" TEXT,
    "idProof" TEXT,
    "idNumber" TEXT,
    "email" TEXT,
    "remarks" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);
