-- CreateEnum
CREATE TYPE "AccountDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "AccountEntryMode" AS ENUM ('CASH_OFFICE', 'CASH_OWNER', 'ONLINE', 'OTHER');

-- CreateEnum
CREATE TYPE "AccountEntryStatus" AS ENUM ('ACTIVE', 'DELETED');

-- CreateTable
CREATE TABLE "AccountEntry" (
    "id" SERIAL NOT NULL,
    "entryDate" DATE NOT NULL,
    "direction" "AccountDirection" NOT NULL,
    "amount" INTEGER NOT NULL,
    "mode" "AccountEntryMode" NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AccountEntryStatus" NOT NULL DEFAULT 'ACTIVE',
    "recordedById" INTEGER,
    "updatedById" INTEGER,
    "deletedById" INTEGER,
    "deletedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AccountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AccountEntry_entryDate_idx" ON "AccountEntry"("entryDate");

-- CreateIndex
CREATE INDEX "Payment_paidOn_idx" ON "Payment"("paidOn");

-- CreateIndex
CREATE INDEX "Refund_refundedOn_idx" ON "Refund"("refundedOn");

-- CreateIndex
CREATE INDEX "StaffAccountEntry_entryDate_idx" ON "StaffAccountEntry"("entryDate");

-- AddForeignKey
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountEntry" ADD CONSTRAINT "AccountEntry_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

