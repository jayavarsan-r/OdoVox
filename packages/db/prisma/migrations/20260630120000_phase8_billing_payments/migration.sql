-- Phase 8 — Billing + Payments + Razorpay (phase8_billing_payments)
--
-- Rewrites the Phase-4 placeholder Bill/Payment into first-class itemized billing.
--
-- LEGACY DATA: Phase 4 inserted only stub Bill/Payment rows (single-line, no clinicId/billNumber,
-- BillStatus 'PENDING', PaymentMethod 'UPI'/'CARD'/'OTHER'). Those values do not exist in the new
-- enums and the new NOT NULL columns (clinicId, billNumber, createdById, paymentNumber, patientId,
-- idempotencyKey) cannot be backfilled meaningfully. They are reproducible demo rows recreated by the
-- seed, so we drop them up-front. Run with `migrate deploy` to preserve trigram (pg_trgm) indexes.
-- On a clinic with real Phase-4 money rows, replace the two DELETEs below with a copy-into-legacy map.

DELETE FROM "Payment";
DELETE FROM "Bill";

-- CreateEnum
CREATE TYPE "ItemKind" AS ENUM ('PROCEDURE', 'LAB_CHARGE', 'MATERIAL', 'ADJUSTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED', 'PARTIAL_REFUND', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "BillStatus_new" AS ENUM ('DRAFT', 'FINALIZED', 'PARTIAL', 'PAID', 'REFUNDED', 'CANCELLED');
ALTER TABLE "public"."Bill" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Bill" ALTER COLUMN "status" TYPE "BillStatus_new" USING ("status"::text::"BillStatus_new");
ALTER TYPE "BillStatus" RENAME TO "BillStatus_old";
ALTER TYPE "BillStatus_new" RENAME TO "BillStatus";
DROP TYPE "public"."BillStatus_old";
ALTER TABLE "Bill" ALTER COLUMN "status" SET DEFAULT 'DRAFT';
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentMethod_new" AS ENUM ('CASH', 'UPI_MANUAL', 'CARD_MANUAL', 'BANK_TRANSFER', 'RAZORPAY', 'ADJUSTMENT');
ALTER TABLE "Payment" ALTER COLUMN "method" TYPE "PaymentMethod_new" USING ("method"::text::"PaymentMethod_new");
ALTER TYPE "PaymentMethod" RENAME TO "PaymentMethod_old";
ALTER TYPE "PaymentMethod_new" RENAME TO "PaymentMethod";
DROP TYPE "public"."PaymentMethod_old";
COMMIT;

-- DropIndex
DROP INDEX "Bill_patientId_idx";

-- DropIndex
DROP INDEX "Bill_status_idx";




-- DropIndex
DROP INDEX "Payment_receivedById_idx";

-- AlterTable
ALTER TABLE "Bill" DROP COLUMN "items",
ADD COLUMN     "balancePaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "billNumber" TEXT NOT NULL,
ADD COLUMN     "cancelledAt" TIMESTAMP(3),
ADD COLUMN     "cancelledReason" TEXT,
ADD COLUMN     "clinicId" TEXT NOT NULL,
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "discountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountReason" TEXT,
ADD COLUMN     "doctorIdSnapshot" TEXT,
ADD COLUMN     "finalizedAt" TIMESTAMP(3),
ADD COLUMN     "gstApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gstPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "gstPercent" DECIMAL(65,30) NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paidInFullAt" TIMESTAMP(3),
ADD COLUMN     "patientNameSnapshot" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "patientPhoneSnapshot" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pdfStorageKey" TEXT,
ADD COLUMN     "pdfUrl" TEXT,
ADD COLUMN     "refundedPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalPaise" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "chargeForMaterials" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gstApplicable" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gstPercent" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "reference",
ADD COLUMN     "bankTxnRef" TEXT,
ADD COLUMN     "cardLast4" TEXT,
ADD COLUMN     "cardNetwork" TEXT,
ADD COLUMN     "clinicId" TEXT NOT NULL,
ADD COLUMN     "idempotencyKey" TEXT NOT NULL,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "patientId" TEXT NOT NULL,
ADD COLUMN     "paymentNumber" TEXT NOT NULL,
ADD COLUMN     "razorpayFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "razorpayLinkId" TEXT,
ADD COLUMN     "razorpayOrderId" TEXT,
ADD COLUMN     "razorpayPaymentId" TEXT,
ADD COLUMN     "razorpaySignature" TEXT,
ADD COLUMN     "refundedAmountPaise" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "upiId" TEXT,
ADD COLUMN     "upiTxnRef" TEXT,
ALTER COLUMN "receivedAt" DROP NOT NULL,
ALTER COLUMN "receivedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "BillItem" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "kind" "ItemKind" NOT NULL,
    "description" TEXT NOT NULL,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPricePaise" INTEGER NOT NULL,
    "discountPaise" INTEGER NOT NULL DEFAULT 0,
    "subtotalPaise" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "refundNumber" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "razorpayRefundId" TEXT,
    "razorpayStatus" TEXT,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "processedById" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentPlan" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "totalPaise" INTEGER NOT NULL,
    "installments" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "source" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signature" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorDetail" TEXT,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillItem_billId_idx" ON "BillItem"("billId");

-- CreateIndex
CREATE INDEX "BillItem_clinicId_sourceType_sourceId_idx" ON "BillItem"("clinicId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "Refund_clinicId_paymentId_idx" ON "Refund"("clinicId", "paymentId");

-- CreateIndex
CREATE INDEX "Refund_clinicId_createdAt_idx" ON "Refund"("clinicId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_clinicId_refundNumber_key" ON "Refund"("clinicId", "refundNumber");

-- CreateIndex
CREATE INDEX "PaymentPlan_clinicId_billId_idx" ON "PaymentPlan"("clinicId", "billId");

-- CreateIndex
CREATE INDEX "WebhookEvent_clinicId_receivedAt_idx" ON "WebhookEvent"("clinicId", "receivedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_source_eventId_key" ON "WebhookEvent"("source", "eventId");

-- CreateIndex
CREATE INDEX "Bill_clinicId_status_createdAt_idx" ON "Bill"("clinicId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Bill_clinicId_patientId_createdAt_idx" ON "Bill"("clinicId", "patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Bill_clinicId_balancePaise_idx" ON "Bill"("clinicId", "balancePaise");

-- CreateIndex
CREATE UNIQUE INDEX "Bill_clinicId_billNumber_key" ON "Bill"("clinicId", "billNumber");

-- CreateIndex
CREATE INDEX "Payment_clinicId_status_createdAt_idx" ON "Payment"("clinicId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Payment_razorpayPaymentId_idx" ON "Payment"("razorpayPaymentId");

-- CreateIndex
CREATE INDEX "Payment_razorpayLinkId_idx" ON "Payment"("razorpayLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_clinicId_paymentNumber_key" ON "Payment"("clinicId", "paymentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_clinicId_idempotencyKey_key" ON "Payment"("clinicId", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillItem" ADD CONSTRAINT "BillItem_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

