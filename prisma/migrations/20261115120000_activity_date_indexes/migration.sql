-- CreateIndex
CREATE INDEX "Contract_startDate_idx" ON "Contract"("startDate");

-- CreateIndex
CREATE INDEX "CustomerOrder_endDate_idx" ON "CustomerOrder"("endDate");

-- CreateIndex
CREATE INDEX "OrderWriteOff_writtenOffOn_idx" ON "OrderWriteOff"("writtenOffOn");

-- CreateIndex
CREATE INDEX "StaffAssignment_startDate_idx" ON "StaffAssignment"("startDate");

-- CreateIndex
CREATE INDEX "StaffAssignment_endDate_idx" ON "StaffAssignment"("endDate");

