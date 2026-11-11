-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "writtenOffAmount" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "OrderWriteOff" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "writtenOffOn" DATE NOT NULL,
    "reason" TEXT NOT NULL,
    "recordedById" INTEGER,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderWriteOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrderWriteOff_orderId_key" ON "OrderWriteOff"("orderId");

-- AddForeignKey
ALTER TABLE "OrderWriteOff" ADD CONSTRAINT "OrderWriteOff_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "CustomerOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderWriteOff" ADD CONSTRAINT "OrderWriteOff_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

