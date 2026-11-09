-- RECEIVED: money the staff paid back. WRITE_OFF: what they owe, forgiven by the owner.
ALTER TYPE "StaffEntryType" ADD VALUE 'RECEIVED';
ALTER TYPE "StaffEntryType" ADD VALUE 'WRITE_OFF';

-- What a clearing settled from RECEIVED + WRITE_OFF entries.
ALTER TABLE "StaffSettlement" ADD COLUMN     "recovered" INTEGER NOT NULL DEFAULT 0;