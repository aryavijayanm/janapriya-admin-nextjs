-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "autoStarted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rateCheckedAt" TIMESTAMPTZ,
ADD COLUMN     "rateCheckedById" INTEGER;

-- CreateIndex
CREATE INDEX "Contract_endDate_idx" ON "Contract"("endDate");

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_rateCheckedById_fkey" FOREIGN KEY ("rateCheckedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
