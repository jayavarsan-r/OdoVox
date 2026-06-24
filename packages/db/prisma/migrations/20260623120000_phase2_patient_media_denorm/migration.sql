-- CreateEnum
CREATE TYPE "PatientStatus" AS ENUM ('NEW', 'ACTIVE', 'IN_CHAIR', 'DUE_PAYMENT', 'LAB_PENDING', 'INACTIVE');

-- AlterTable
ALTER TABLE "Media" DROP COLUMN "notes",
DROP COLUMN "thumbnailUrl",
ADD COLUMN     "clinicId" TEXT NOT NULL,
ADD COLUMN     "height" INTEGER,
ADD COLUMN     "mimeType" TEXT NOT NULL,
ADD COLUMN     "notesEnc" TEXT,
ADD COLUMN     "sizeBytes" INTEGER NOT NULL,
ADD COLUMN     "storageKey" TEXT NOT NULL,
ADD COLUMN     "thumbnailKey" TEXT,
ADD COLUMN     "width" INTEGER,
ALTER COLUMN "url" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "address",
ADD COLUMN     "addressEnc" TEXT,
ADD COLUMN     "chiefComplaint" TEXT,
ADD COLUMN     "lastVisitAt" TIMESTAMP(3),
ADD COLUMN     "outstandingPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "PatientStatus" NOT NULL DEFAULT 'NEW';

-- AlterTable
ALTER TABLE "Prescription" ADD COLUMN     "pdfStorageKey" TEXT;

-- AlterTable
ALTER TABLE "ToothRecord" ADD COLUMN     "lastUpdatedById" TEXT,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "TreatmentPlan" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "manualEntry" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Media_clinicId_patientId_uploadedAt_idx" ON "Media"("clinicId", "patientId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Trigram search on patients (name / phone / code). Index not modelled in schema.prisma.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "Patient_name_trgm_idx" ON "Patient" USING gin ("name" gin_trgm_ops);
CREATE INDEX "Patient_phone_trgm_idx" ON "Patient" USING gin ("phone" gin_trgm_ops);
CREATE INDEX "Patient_patientCode_trgm_idx" ON "Patient" USING gin ("patientCode" gin_trgm_ops);
