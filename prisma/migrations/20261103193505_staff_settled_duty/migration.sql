-- AlterEnum
BEGIN;
CREATE TYPE "StaffEntryType_new" AS ENUM ('PAID', 'EXTRA');
ALTER TABLE "StaffAccountEntry" ALTER COLUMN "type" TYPE "StaffEntryType_new" USING ("type"::text::"StaffEntryType_new");
ALTER TYPE "StaffEntryType" RENAME TO "StaffEntryType_old";
ALTER TYPE "StaffEntryType_new" RENAME TO "StaffEntryType";
DROP TYPE "public"."StaffEntryType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "StaffAccountEntry" DROP CONSTRAINT "StaffAccountEntry_adjustsSettlementId_fkey";

-- DropForeignKey
ALTER TABLE "StaffSettlementLine" DROP CONSTRAINT "StaffSettlementLine_settlementId_fkey";

-- DropIndex
DROP INDEX "StaffSettlement_staffId_clearedUpTo_idx";

-- AlterTable
ALTER TABLE "StaffAccountEntry" DROP COLUMN "adjustsSettlementId";

-- AlterTable
ALTER TABLE "StaffSettlement" DROP COLUMN "clearedUpTo",
ADD COLUMN     "clearedOn" DATE NOT NULL;

-- DropTable
DROP TABLE "StaffSettlementLine";

-- CreateTable
CREATE TABLE "StaffSettledDuty" (
    "id" SERIAL NOT NULL,
    "settlementId" INTEGER NOT NULL,
    "staffId" INTEGER NOT NULL,
    "dutyId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "orderCode" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "contractNumber" INTEGER NOT NULL,
    "staffSalary" INTEGER NOT NULL,
    "fromDate" DATE NOT NULL,
    "toDate" DATE NOT NULL,
    "halfDays" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "settledFrom" DATE,
    "settledTo" DATE,
    "settledHalfDays" INTEGER NOT NULL,
    "settledAmount" INTEGER NOT NULL,

    CONSTRAINT "StaffSettledDuty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffSettledDuty_settlementId_idx" ON "StaffSettledDuty"("settlementId");

-- CreateIndex
CREATE INDEX "StaffSettledDuty_staffId_dutyId_contractNumber_idx" ON "StaffSettledDuty"("staffId", "dutyId", "contractNumber");

-- CreateIndex
CREATE INDEX "StaffSettlement_staffId_clearedOn_idx" ON "StaffSettlement"("staffId", "clearedOn");

-- AddForeignKey
ALTER TABLE "StaffSettledDuty" ADD CONSTRAINT "StaffSettledDuty_settlementId_fkey" FOREIGN KEY ("settlementId") REFERENCES "StaffSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffSettledDuty" ADD CONSTRAINT "StaffSettledDuty_dutyId_fkey" FOREIGN KEY ("dutyId") REFERENCES "StaffAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
