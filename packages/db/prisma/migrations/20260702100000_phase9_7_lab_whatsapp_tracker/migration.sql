-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.

ALTER TYPE "LabCaseStatus" ADD VALUE 'ACKNOWLEDGED';
ALTER TYPE "LabCaseStatus" ADD VALUE 'DISPATCHED';
ALTER TYPE "LabCaseStatus" ADD VALUE 'RECEIVED';
ALTER TYPE "LabCaseStatus" ADD VALUE 'FITTED';
ALTER TYPE "LabCaseStatus" ADD VALUE 'ISSUE_RAISED';

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "caseCodePrefix" TEXT,
ADD COLUMN     "labCaseSeq" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "LabCase" ADD COLUMN     "caseCode" TEXT,
ADD COLUMN     "statusUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "statusUpdatedBy" TEXT NOT NULL DEFAULT 'reception_manual';

-- AlterTable
ALTER TABLE "LabVendor" ADD COLUMN     "automationPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "consentLoggedAt" TIMESTAMP(3),
ADD COLUMN     "preferredLanguage" TEXT NOT NULL DEFAULT 'en',
ADD COLUMN     "whatsappPhoneNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'clinic_upload';

-- CreateTable
CREATE TABLE "LabMessage" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "labVendorId" TEXT,
    "labCaseId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "waMessageId" TEXT NOT NULL,
    "body" TEXT,
    "mediaPaths" TEXT[],
    "parseTier" TEXT,
    "parseConfidence" DECIMAL(65,30),
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "buttonPayload" JSONB,
    "fromPhone" TEXT,
    "templateKey" TEXT,
    "costPaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabCaseEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "labCaseId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "sourceLabMessageId" TEXT,
    "note" TEXT,
    "byUserId" TEXT,
    "undoneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LabMessage_waMessageId_key" ON "LabMessage"("waMessageId");

-- CreateIndex
CREATE INDEX "LabMessage_clinicId_labVendorId_createdAt_idx" ON "LabMessage"("clinicId", "labVendorId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LabMessage_clinicId_resolved_createdAt_idx" ON "LabMessage"("clinicId", "resolved", "createdAt");

-- CreateIndex
CREATE INDEX "LabCaseEvent_labCaseId_createdAt_idx" ON "LabCaseEvent"("labCaseId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LabCaseEvent_clinicId_createdAt_idx" ON "LabCaseEvent"("clinicId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LabCase_clinicId_caseCode_key" ON "LabCase"("clinicId", "caseCode");

-- AddForeignKey
ALTER TABLE "LabMessage" ADD CONSTRAINT "LabMessage_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabMessage" ADD CONSTRAINT "LabMessage_labVendorId_fkey" FOREIGN KEY ("labVendorId") REFERENCES "LabVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabMessage" ADD CONSTRAINT "LabMessage_labCaseId_fkey" FOREIGN KEY ("labCaseId") REFERENCES "LabCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCaseEvent" ADD CONSTRAINT "LabCaseEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCaseEvent" ADD CONSTRAINT "LabCaseEvent_labCaseId_fkey" FOREIGN KEY ("labCaseId") REFERENCES "LabCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
