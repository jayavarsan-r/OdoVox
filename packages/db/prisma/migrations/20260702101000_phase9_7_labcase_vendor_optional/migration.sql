-- Phase 9.7: voice-suggested DRAFT lab cases are created before reception picks the lab.
ALTER TABLE "LabCase" ALTER COLUMN "vendorId" DROP NOT NULL;
