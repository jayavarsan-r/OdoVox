-- Phase 8b — voice procedure cost, lab billed-marker, bill reminders (additive)




-- AlterTable
ALTER TABLE "LabCase" ADD COLUMN     "billedInBillId" TEXT;

-- AlterTable
ALTER TABLE "Procedure" ADD COLUMN     "estimatedCostPaise" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BillReminder" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "status" "ReminderStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "errorReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillReminder_clinicId_status_scheduledFor_idx" ON "BillReminder"("clinicId", "status", "scheduledFor");

-- CreateIndex
CREATE INDEX "BillReminder_billId_idx" ON "BillReminder"("billId");

-- AddForeignKey
ALTER TABLE "BillReminder" ADD CONSTRAINT "BillReminder_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

