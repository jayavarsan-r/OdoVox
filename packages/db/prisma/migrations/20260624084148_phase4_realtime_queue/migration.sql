-- Phase 4 — realtime queue.
--
-- INDEX NOTE: Prisma's diff again proposes dropping the Phase-2 trigram GIN indexes
-- (Patient_name/phone/patientCode_trgm_idx) because they are raw-SQL indexes not modeled in the
-- Prisma schema. Those DROPs are intentionally omitted here to preserve patient search — same as
-- the Phase 3 migration.
--
-- ENUM NOTE: ADD VALUE on VisitStatus is data-safe — existing WAITING/IN_CHAIR/CHECKOUT/COMPLETED/
-- CANCELLED/NO_SHOW rows are untouched; SCHEDULED + CHECKED_IN are simply now available.

-- CreateEnum
CREATE TYPE "RoomStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'OFFLINE');

-- CreateEnum
CREATE TYPE "QueueEventType" AS ENUM ('CHECKED_IN', 'CALLED_IN', 'RETURNED_TO_QUEUE', 'CHECKOUT_STARTED', 'COMPLETED', 'CANCELLED', 'REASSIGNED', 'PRIORITY_CHANGED', 'DOCTOR_RECORDING', 'DOCTOR_RECORDING_DONE');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "VisitStatus" ADD VALUE 'SCHEDULED';
ALTER TYPE "VisitStatus" ADD VALUE 'CHECKED_IN';

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "status" "RoomStatus" NOT NULL DEFAULT 'AVAILABLE';

-- AlterTable
ALTER TABLE "Visit" ADD COLUMN     "assignedDoctorId" TEXT,
ADD COLUMN     "calledInAt" TIMESTAMP(3),
ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "checkoutStartedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "lifecycleVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "QueueEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" "QueueEventType" NOT NULL,
    "byUserId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueEvent_clinicId_createdAt_idx" ON "QueueEvent"("clinicId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "QueueEvent_clinicId_visitId_createdAt_idx" ON "QueueEvent"("clinicId", "visitId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Visit_clinicId_status_assignedDoctorId_priority_checkedInAt_idx" ON "Visit"("clinicId", "status", "assignedDoctorId", "priority" DESC, "checkedInAt" ASC);

-- CreateIndex
CREATE INDEX "Visit_clinicId_status_calledInAt_idx" ON "Visit"("clinicId", "status", "calledInAt" DESC);

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEvent" ADD CONSTRAINT "QueueEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEvent" ADD CONSTRAINT "QueueEvent_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEvent" ADD CONSTRAINT "QueueEvent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEvent" ADD CONSTRAINT "QueueEvent_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
