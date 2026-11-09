-- Staff balances list (look-up only): balance estimated until yesterday.
-- Filled by the app (refresh after money changes + nightly job).
ALTER TABLE "Staff" ADD COLUMN     "balanceDue" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Staff_balanceDue_idx" ON "Staff"("balanceDue");