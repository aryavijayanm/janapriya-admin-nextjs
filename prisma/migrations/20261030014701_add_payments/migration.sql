-- CreateEnum
CREATE TYPE "PaymentMode" AS ENUM ('CASH_OFFICE', 'CASH_OWNER', 'TO_ACCOUNT', 'PAID_TO_STAFF', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_PAID', 'PARTLY_PAID', 'FULLY_PAID');

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "fullyPaidOn" DATE,
ADD COLUMN     "paidAmount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_PAID';

-- CreateTable
CREATE TABLE "Payment" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "paidOn" DATE NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "accountDetails" TEXT,
    "recordedById" INTEGER,
    "voidedAt" TIMESTAMPTZ,
    "voidedById" INTEGER,
    "voidReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Payment_contractId_idx" ON "Payment"("contractId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
