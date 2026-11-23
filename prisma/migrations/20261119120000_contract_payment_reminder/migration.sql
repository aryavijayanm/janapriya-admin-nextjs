-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "reminderSentAt" TIMESTAMPTZ,
ADD COLUMN     "reminderSentById" INTEGER;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_reminderSentById_fkey" FOREIGN KEY ("reminderSentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
