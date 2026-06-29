-- AlterEnum
ALTER TYPE "PlanStatus" ADD VALUE 'ON_HOLD';

-- AlterTable: Sitting clinical notes are now encrypted at rest (§PHI).
ALTER TABLE "Sitting" DROP COLUMN "notes",
ADD COLUMN     "notesEnc" TEXT;

-- AlterTable: TreatmentPlan lifecycle (parent visit, completion/cancellation).
ALTER TABLE "TreatmentPlan" ADD COLUMN     "cancellationReason" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "parentVisitId" TEXT;

-- CreateIndex: prevent duplicate sitting N of the same procedure.
CREATE UNIQUE INDEX "Sitting_procedureId_sittingNumber_key" ON "Sitting"("procedureId", "sittingNumber");
