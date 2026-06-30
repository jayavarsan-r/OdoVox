-- CreateEnum
CREATE TYPE "LabCaseType" AS ENUM ('CROWN', 'BRIDGE', 'DENTURE_FULL', 'DENTURE_PARTIAL', 'ALIGNER', 'NIGHT_GUARD', 'OCCLUSAL_SPLINT', 'VENEER', 'INLAY_ONLAY', 'RPD', 'OTHER');

-- CreateEnum
CREATE TYPE "MovementKind" AS ENUM ('PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'DISPOSAL_EXPIRED');

-- DropTable (must precede the LabCaseStatus enum swap: LabCaseEvent.status depends on the old enum)
DROP TABLE "LabCaseEvent";

-- AlterEnum
BEGIN;
CREATE TYPE "LabCaseStatus_new" AS ENUM ('DRAFT', 'SENT', 'IN_PROGRESS', 'READY', 'DELIVERED', 'RETURNED_FOR_REWORK', 'COMPLETED', 'CANCELLED');
ALTER TABLE "public"."LabCase" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "LabCase" ALTER COLUMN "status" TYPE "LabCaseStatus_new" USING ("status"::text::"LabCaseStatus_new");
ALTER TYPE "LabCaseStatus" RENAME TO "LabCaseStatus_old";
ALTER TYPE "LabCaseStatus_new" RENAME TO "LabCaseStatus";
DROP TYPE "public"."LabCaseStatus_old";
ALTER TABLE "LabCase" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
ALTER TYPE "MediaType" ADD VALUE 'LAB_PHOTO';

-- DropForeignKey
ALTER TABLE "InventoryMovement" DROP CONSTRAINT "InventoryMovement_createdById_fkey";

-- DropForeignKey
ALTER TABLE "LabCase" DROP CONSTRAINT "LabCase_partnerId_fkey";

-- DropForeignKey
ALTER TABLE "LabPartner" DROP CONSTRAINT "LabPartner_clinicId_fkey";

-- DropIndex
DROP INDEX "InventoryItem_clinicId_category_idx";

-- DropIndex
DROP INDEX "InventoryItem_clinicId_idx";

-- DropIndex
DROP INDEX "InventoryMovement_createdById_idx";

-- DropIndex
DROP INDEX "InventoryMovement_itemId_idx";

-- DropIndex
DROP INDEX "LabCase_clinicId_status_idx";

-- DropIndex
DROP INDEX "LabCase_partnerId_idx";

-- DropIndex
DROP INDEX "LabCase_patientId_idx";

-- NOTE: Patient *_trgm_idx DROP INDEX statements intentionally removed — these GIN
-- trigram indexes are created out-of-band and must survive every migration (see
-- prisma-trgm-index-drop-gotcha memory). Do NOT let `migrate diff` reintroduce them.

-- AlterTable
ALTER TABLE "InventoryItem" DROP COLUMN "category",
DROP COLUMN "deletedAt",
DROP COLUMN "lowStockThreshold",
DROP COLUMN "trackExpiry",
DROP COLUMN "unit",
ADD COLUMN     "batchNumber" TEXT,
ADD COLUMN     "categoryId" TEXT NOT NULL,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "expiryDate" TIMESTAMP(3),
ADD COLUMN     "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastPurchaseDate" TIMESTAMP(3),
ADD COLUMN     "lastPurchasePricePaise" INTEGER,
ADD COLUMN     "reorderLevel" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sku" TEXT,
ADD COLUMN     "unitOfMeasure" TEXT NOT NULL,
ADD COLUMN     "vendorName" TEXT,
ALTER COLUMN "currentStock" SET DEFAULT 0,
ALTER COLUMN "currentStock" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "InventoryMovement" DROP COLUMN "createdById",
DROP COLUMN "type",
ADD COLUMN     "byUserId" TEXT NOT NULL,
ADD COLUMN     "clinicId" TEXT NOT NULL,
ADD COLUMN     "kind" "MovementKind" NOT NULL,
ADD COLUMN     "pricePerUnitPaise" INTEGER,
ADD COLUMN     "procedureName" TEXT,
ADD COLUMN     "totalPricePaise" INTEGER,
ADD COLUMN     "visitId" TEXT,
ALTER COLUMN "quantity" SET DATA TYPE INTEGER;

-- AlterTable
ALTER TABLE "LabCase" DROP COLUMN "actualDate",
DROP COLUMN "caseType",
DROP COLUMN "deletedAt",
DROP COLUMN "expectedDate",
DROP COLUMN "notes",
DROP COLUMN "partnerId",
DROP COLUMN "toothNumbers",
ADD COLUMN     "caseNumber" TEXT NOT NULL,
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "costPaise" INTEGER,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "description" TEXT,
ADD COLUMN     "expectedReturnAt" TIMESTAMP(3),
ADD COLUMN     "impressionTakenAt" TIMESTAMP(3),
ADD COLUMN     "material" TEXT,
ADD COLUMN     "notesEnc" TEXT,
ADD COLUMN     "patientChargePaise" INTEGER,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "returnedAt" TIMESTAMP(3),
ADD COLUMN     "reworkOfId" TEXT,
ADD COLUMN     "sentAt" TIMESTAMP(3),
ADD COLUMN     "shade" TEXT,
ADD COLUMN     "teeth" INTEGER[],
ADD COLUMN     "treatmentPlanId" TEXT,
ADD COLUMN     "type" "LabCaseType" NOT NULL,
ADD COLUMN     "vendorId" TEXT NOT NULL,
ADD COLUMN     "visitId" TEXT,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Media" ADD COLUMN     "labCaseId" TEXT;

-- DropTable
DROP TABLE "LabPartner";

-- DropEnum
DROP TYPE "InventoryCategory";

-- DropEnum
DROP TYPE "MovementType";

-- CreateTable
CREATE TABLE "LabVendor" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPhoneEnc" TEXT NOT NULL,
    "contactPersonName" TEXT,
    "addressEnc" TEXT,
    "email" TEXT,
    "defaultTurnaroundDays" INTEGER NOT NULL DEFAULT 7,
    "specialties" TEXT[],
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "iconName" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LabVendor_clinicId_isArchived_name_idx" ON "LabVendor"("clinicId", "isArchived", "name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_clinicId_name_key" ON "InventoryCategory"("clinicId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_clinicId_isArchived_categoryId_name_idx" ON "InventoryItem"("clinicId", "isArchived", "categoryId", "name");

-- CreateIndex
CREATE INDEX "InventoryItem_clinicId_currentStock_reorderLevel_idx" ON "InventoryItem"("clinicId", "currentStock", "reorderLevel");

-- CreateIndex
CREATE INDEX "InventoryItem_clinicId_expiryDate_idx" ON "InventoryItem"("clinicId", "expiryDate");

-- CreateIndex
CREATE INDEX "InventoryMovement_clinicId_itemId_createdAt_idx" ON "InventoryMovement"("clinicId", "itemId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "InventoryMovement_clinicId_kind_createdAt_idx" ON "InventoryMovement"("clinicId", "kind", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LabCase_clinicId_status_expectedReturnAt_idx" ON "LabCase"("clinicId", "status", "expectedReturnAt");

-- CreateIndex
CREATE INDEX "LabCase_clinicId_patientId_createdAt_idx" ON "LabCase"("clinicId", "patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "LabCase_clinicId_vendorId_status_idx" ON "LabCase"("clinicId", "vendorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LabCase_clinicId_caseNumber_key" ON "LabCase"("clinicId", "caseNumber");

-- CreateIndex
CREATE INDEX "Media_labCaseId_idx" ON "Media"("labCaseId");

-- AddForeignKey
ALTER TABLE "LabVendor" ADD CONSTRAINT "LabVendor_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabVendor" ADD CONSTRAINT "LabVendor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCase" ADD CONSTRAINT "LabCase_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCase" ADD CONSTRAINT "LabCase_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "LabVendor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCase" ADD CONSTRAINT "LabCase_reworkOfId_fkey" FOREIGN KEY ("reworkOfId") REFERENCES "LabCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryCategory" ADD CONSTRAINT "InventoryCategory_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_byUserId_fkey" FOREIGN KEY ("byUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_labCaseId_fkey" FOREIGN KEY ("labCaseId") REFERENCES "LabCase"("id") ON DELETE SET NULL ON UPDATE CASCADE;

