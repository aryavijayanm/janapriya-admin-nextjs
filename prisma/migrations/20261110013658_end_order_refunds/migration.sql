-- End order: charge for served days, refunds, end note, restart link.
-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "charge" INTEGER,
ADD COLUMN     "refundedAmount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CustomerOrder" ADD COLUMN     "endNote" TEXT,
ADD COLUMN     "restartedFromId" INTEGER;

-- CreateTable
CREATE TABLE "Refund" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "refundedOn" DATE NOT NULL,
    "mode" "PaymentMode" NOT NULL,
    "accountDetails" TEXT,
    "remarks" TEXT NOT NULL,
    "recordedById" INTEGER,
    "voidedAt" TIMESTAMPTZ,
    "voidedById" INTEGER,
    "voidReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_contractId_idx" ON "Refund"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerOrder_restartedFromId_key" ON "CustomerOrder"("restartedFromId");

-- AddForeignKey
ALTER TABLE "CustomerOrder" ADD CONSTRAINT "CustomerOrder_restartedFromId_fkey" FOREIGN KEY ("restartedFromId") REFERENCES "CustomerOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_voidedById_fkey" FOREIGN KEY ("voidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
