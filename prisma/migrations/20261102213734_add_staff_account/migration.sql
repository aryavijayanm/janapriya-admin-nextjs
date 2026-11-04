-- CreateEnum
CREATE TYPE "StaffEntryType" AS ENUM ('PAID', 'EXTRA', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StaffPaymentMode" AS ENUM ('CASH_OFFICE', 'CASH_OWNER', 'CASH_CUSTOMER', 'ONLINE_TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "StaffAccountEntry" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "type" "StaffEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "entryDate" DATE NOT NULL,
    "remarks" TEXT NOT NULL,
    "mode" "StaffPaymentMode",
    "accountDetails" TEXT,
    "recordedById" INTEGER,
    "voidedAt" TIMESTAMPTZ,
    "voidedById" INTEGER,
    "voidReason" TEXT,
    "settlementId" INTEGER,
    "adjustsSettlementId" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAccountEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSettlement" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "clearedUpTo" DATE NOT NULL,
    "earned" INTEGER NOT NULL,
    "extras" INTEGER NOT NULL,
    "paid" INTEGER NOT NULL,
    "finalAmount" INTEGER NOT NULL,
    "clearedById" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffSettlementLine" (
    "id" SERIAL NOT NULL,
    "settlementId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "orderCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "contractNumber" INTEGER NOT NULL,
    "staffSalary" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "halfDays" INTEGER NOT NULL,
    "earned" INTEGER NOT NULL,

    CONSTRAINT "StaffSettlementLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffAccountEntry_staffId_settlementId_idx" ON "StaffAccountEntry"("staffId", "settlementId");

-- CreateIndex
CREATE INDEX "StaffSettlement_staffId_clearedUpTo_idx" ON "StaffSettlement"("staffId", "clearedUpTo");

-- CreateIndex
CREATE INDEX "StaffSettlementLine_settlementId_idx" ON "StaffSettlementLine"("settlementId");

-- AddForeignKey
ALTER TABLE "StaffAccountEntry" ADD CONSTRAINT "StaffAccountEntry_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAccountEntry" ADD CONSTRAINT "StaffAccountEntry_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAccountEntry" ADD CONSTRAINT "StaffAccountEntry_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAccountEntry" ADD CONSTRAINT "StaffAccountEntry_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "StaffSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAccountEntry" ADD CONSTRAINT "StaffAccountEntry_adjustsSettlementId_fkey" FOREIGN KEY ("adjustsSettlementId") REFERENCES "StaffSettlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSettlement" ADD CONSTRAINT "StaffSettlement_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSettlement" ADD CONSTRAINT "StaffSettlement_clearedById_fkey" FOREIGN KEY ("clearedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSettlementLine" ADD CONSTRAINT "StaffSettlementLine_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "StaffSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
