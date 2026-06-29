-- Phase 6: Schedule & Appointments
-- Hand-edited from `prisma migrate diff` to be data-safe (existing Appointment rows) and to
-- PRESERVE the Patient trigram (pg_trgm GIN) indexes that the diff always proposes dropping.

-- CreateEnum
CREATE TYPE "ReminderStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'CANCELLED');

-- AlterEnum: AppointmentStatus — CONFIRMED is replaced by CHECKED_IN. Legacy CONFIRMED rows are
-- future bookings (patient hasn't arrived) so they map to SCHEDULED, not CHECKED_IN (which means
-- the Phase 4 queue has taken over). Done before the USING cast since CONFIRMED no longer exists.
BEGIN;
CREATE TYPE "AppointmentStatus_new" AS ENUM ('SCHEDULED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');
ALTER TABLE "public"."Appointment" ALTER COLUMN "status" DROP DEFAULT;
UPDATE "Appointment" SET "status" = 'SCHEDULED' WHERE "status"::text = 'CONFIRMED';
ALTER TABLE "Appointment" ALTER COLUMN "status" TYPE "AppointmentStatus_new" USING ("status"::text::"AppointmentStatus_new");
ALTER TYPE "AppointmentStatus" RENAME TO "AppointmentStatus_old";
ALTER TYPE "AppointmentStatus_new" RENAME TO "AppointmentStatus";
DROP TYPE "public"."AppointmentStatus_old";
ALTER TABLE "Appointment" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED';
COMMIT;

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_parentAppointmentId_fkey";

-- DropIndex
DROP INDEX "Appointment_clinicId_scheduledAt_idx";
DROP INDEX "Appointment_doctorId_scheduledAt_idx";
DROP INDEX "Appointment_parentAppointmentId_idx";
DROP INDEX "Appointment_patientId_idx";
DROP INDEX "DoctorAvailability_doctorId_date_idx";
-- NOTE: Patient_*_trgm_idx DROPs intentionally omitted (pg_trgm GIN indexes, Prisma can't model them).

-- AlterTable: Appointment. Add new columns nullable first, backfill from old columns, then enforce.
ALTER TABLE "Appointment"
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "createdById" TEXT,
  ADD COLUMN "endsAt" TIMESTAMP(3),
  ADD COLUMN "noShowAt" TIMESTAMP(3),
  ADD COLUMN "originalStartsAt" TIMESTAMP(3),
  ADD COLUMN "procedureHint" TEXT,
  ADD COLUMN "rescheduleCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "roomId" TEXT,
  ADD COLUMN "seriesId" TEXT,
  ADD COLUMN "seriesIndex" INTEGER,
  ADD COLUMN "seriesTotal" INTEGER,
  ADD COLUMN "sittingNumber" INTEGER,
  ADD COLUMN "startsAt" TIMESTAMP(3),
  ADD COLUMN "treatmentPlanId" TEXT;

-- Backfill: startsAt <- scheduledAt, endsAt <- scheduledAt + duration, procedureHint <- procedureType,
-- createdById <- doctorId (the owning doctor is the best available creator for legacy rows).
UPDATE "Appointment" SET
  "startsAt" = "scheduledAt",
  "endsAt" = "scheduledAt" + ("durationMinutes" * interval '1 minute'),
  "procedureHint" = "procedureType",
  "createdById" = "doctorId";

-- Enforce NOT NULL now that data is populated.
ALTER TABLE "Appointment"
  ALTER COLUMN "startsAt" SET NOT NULL,
  ALTER COLUMN "endsAt" SET NOT NULL,
  ALTER COLUMN "createdById" SET NOT NULL;

-- Drop legacy columns.
ALTER TABLE "Appointment"
  DROP COLUMN "parentAppointmentId",
  DROP COLUMN "procedureType",
  DROP COLUMN "scheduledAt";

-- AlterTable: Clinic
ALTER TABLE "Clinic" ADD COLUMN "noShowGraceMinutes" INTEGER NOT NULL DEFAULT 30;

-- AlterTable: DoctorAvailability is repurposed from a per-date exception model into a recurring
-- weekly template. The old rows have no meaningful mapping (no dayOfWeek/clinicId), and the model
-- was unused by application code, so clear them before restructuring.
DELETE FROM "DoctorAvailability";
ALTER TABLE "DoctorAvailability"
  DROP COLUMN "date",
  DROP COLUMN "reason",
  DROP COLUMN "type",
  ADD COLUMN "clinicId" TEXT NOT NULL,
  ADD COLUMN "dayOfWeek" INTEGER NOT NULL,
  ADD COLUMN "effectiveFrom" TIMESTAMP(3),
  ADD COLUMN "effectiveTo" TIMESTAMP(3),
  ALTER COLUMN "startTime" SET NOT NULL,
  ALTER COLUMN "endTime" SET NOT NULL;

-- DropEnum
DROP TYPE "AvailabilityType";

-- CreateTable
CREATE TABLE "DayOff" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "scope" TEXT NOT NULL,
    "doctorId" TEXT,
    "reason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DayOff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppointmentReminder" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DayOff_clinicId_date_idx" ON "DayOff"("clinicId", "date");
CREATE INDEX "DayOff_clinicId_doctorId_date_idx" ON "DayOff"("clinicId", "doctorId", "date");
CREATE INDEX "AppointmentReminder_clinicId_status_scheduledFor_idx" ON "AppointmentReminder"("clinicId", "status", "scheduledFor");
CREATE INDEX "AppointmentReminder_appointmentId_idx" ON "AppointmentReminder"("appointmentId");
CREATE INDEX "Appointment_clinicId_startsAt_doctorId_idx" ON "Appointment"("clinicId", "startsAt", "doctorId");
CREATE INDEX "Appointment_clinicId_status_startsAt_idx" ON "Appointment"("clinicId", "status", "startsAt");
CREATE INDEX "Appointment_clinicId_seriesId_idx" ON "Appointment"("clinicId", "seriesId");
CREATE INDEX "Appointment_clinicId_patientId_startsAt_idx" ON "Appointment"("clinicId", "patientId", "startsAt" DESC);
CREATE INDEX "DoctorAvailability_clinicId_doctorId_dayOfWeek_idx" ON "DoctorAvailability"("clinicId", "doctorId", "dayOfWeek");
CREATE UNIQUE INDEX "DoctorAvailability_doctorId_dayOfWeek_startTime_effectiveFr_key" ON "DoctorAvailability"("doctorId", "dayOfWeek", "startTime", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DayOff" ADD CONSTRAINT "DayOff_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AppointmentReminder" ADD CONSTRAINT "AppointmentReminder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
