-- What the next period starts with (+ = kept, still owed to the staff; - = the staff owes).
ALTER TABLE "StaffSettlement" ADD COLUMN     "carriedForward" INTEGER NOT NULL DEFAULT 0;

-- Existing clearings: until now only "the staff owed" was carried (a minus final amount).
UPDATE "StaffSettlement" SET "carriedForward" = LEAST("finalAmount", 0);