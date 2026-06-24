-- Phase 3 — voice + AI pipeline.
--
-- DATA NOTE (encrypt-on-migrate): at migration time there were 0 Consultation rows (and 0 with a
-- non-null `rawTranscript`), so the "encrypt existing plaintext transcripts" data-step is a NO-OP.
-- The column is RENAMED (not dropped + re-added) so any data is preserved regardless. Had rows
-- existed, they would be encrypted by a Node data-migration first (encryptField is app-level
-- AES-256-GCM, not expressible in SQL) and only then renamed.
--
-- INDEX NOTE: Prisma's diff proposes dropping the Phase-2 trigram GIN indexes
-- (Patient_name/phone/patientCode_trgm_idx) because they are raw-SQL indexes not modeled in the
-- Prisma schema. Those DROPs are intentionally omitted here to preserve patient search.

-- CreateEnum
CREATE TYPE "JobKind" AS ENUM ('STT', 'EXTRACTION_CLINICAL', 'EXTRACTION_PRESCRIPTION', 'EXTRACTION_INTAKE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- AlterTable: rename the transcript column (data-preserving) ...
ALTER TABLE "Consultation" RENAME COLUMN "rawTranscript" TO "rawTranscriptEnc";

-- ... then add the Phase 3 telemetry / safety / rejection fields.
ALTER TABLE "Consultation"
ADD COLUMN     "audioDurationMs" INTEGER,
ADD COLUMN     "audioStorageKey" TEXT,
ADD COLUMN     "extractionLatencyMs" INTEGER,
ADD COLUMN     "languageCode" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "rejectedById" TEXT,
ADD COLUMN     "rejectedReason" TEXT,
ADD COLUMN     "safetyWarnings" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "sttLatencyMs" INTEGER;

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "kind" "JobKind" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "inputRef" TEXT NOT NULL,
    "provider" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_clinicId_status_createdAt_idx" ON "Job"("clinicId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_inputRef_idx" ON "Job"("inputRef");

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_rejectedById_fkey" FOREIGN KEY ("rejectedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
