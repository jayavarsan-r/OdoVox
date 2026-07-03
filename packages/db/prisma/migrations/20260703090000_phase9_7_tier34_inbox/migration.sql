-- Phase 9.7 sub-stage 2.C: tier-3 suggestions + tier-4 labeled examples.
ALTER TABLE "LabMessage" ADD COLUMN "llmSuggestion" JSONB;

CREATE TABLE "LabParseTrainingExample" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "labMessageId" TEXT NOT NULL,
    "body" TEXT,
    "resolvedCaseId" TEXT,
    "resolvedStatus" TEXT,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabParseTrainingExample_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LabParseTrainingExample_clinicId_createdAt_idx" ON "LabParseTrainingExample"("clinicId", "createdAt");

ALTER TABLE "LabParseTrainingExample" ADD CONSTRAINT "LabParseTrainingExample_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
