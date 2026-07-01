-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('NOT_ASKED', 'PENDING', 'OPTED_IN', 'OPTED_OUT', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TemplateCategory" AS ENUM ('UTILITY', 'MARKETING', 'AUTHENTICATION', 'SERVICE');

-- CreateEnum
CREATE TYPE "TemplateApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DELETED');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('OUTBOUND', 'INBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('PENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'RECEIVED', 'BLOCKED_NO_CONSENT', 'BLOCKED_BUDGET');

-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');

-- CreateEnum
CREATE TYPE "ConversationCategory" AS ENUM ('RESCHEDULE_REQUEST', 'COMPLAINT', 'GENERAL_QUERY', 'PRESCRIPTION_QUESTION', 'PAYMENT_QUERY', 'OTHER');

-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "whatsappAccountPhoneNumber" TEXT,
ADD COLUMN     "whatsappAccountStatus" TEXT,
ADD COLUMN     "whatsappBudgetPaise" INTEGER,
ADD COLUMN     "whatsappBudgetWarningThreshold" DECIMAL(65,30) NOT NULL DEFAULT 0.8;

-- CreateTable
CREATE TABLE "PatientWhatsAppConsent" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "ConsentStatus" NOT NULL DEFAULT 'NOT_ASKED',
    "optedInAt" TIMESTAMP(3),
    "optedInByUserId" TEXT,
    "optedInMethod" TEXT,
    "optedOutAt" TIMESTAMP(3),
    "optedOutReason" TEXT,
    "lastReconfirmedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientWhatsAppConsent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "templateKey" TEXT NOT NULL,
    "templateName" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "category" "TemplateCategory" NOT NULL,
    "approvalStatus" "TemplateApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "body" TEXT NOT NULL,
    "variables" TEXT[],
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "estimatedCostPaise" INTEGER NOT NULL DEFAULT 35,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT,
    "direction" "MessageDirection" NOT NULL,
    "templateId" TEXT,
    "templateVariables" JSONB,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "providerMessageId" TEXT,
    "providerStatus" TEXT,
    "costPaise" INTEGER NOT NULL DEFAULT 0,
    "idempotencyKey" TEXT,
    "triggerType" TEXT,
    "triggerEntityType" TEXT,
    "triggerEntityId" TEXT,
    "inboundFromPhone" TEXT,
    "inboundType" TEXT,
    "inboundButtonId" TEXT,
    "status" "MessageStatus" NOT NULL DEFAULT 'PENDING',
    "failureReason" TEXT,
    "conversationId" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientConversation" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "status" "ConversationStatus" NOT NULL DEFAULT 'OPEN',
    "category" "ConversationCategory",
    "lastInboundAt" TIMESTAMP(3),
    "windowExpiresAt" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "lastMessagePreview" TEXT,
    "unreadCount" INTEGER NOT NULL DEFAULT 0,
    "assignedToUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppCostLog" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "conversationsCount" INTEGER NOT NULL DEFAULT 0,
    "utilityCount" INTEGER NOT NULL DEFAULT 0,
    "serviceCount" INTEGER NOT NULL DEFAULT 0,
    "marketingCount" INTEGER NOT NULL DEFAULT 0,
    "totalCostPaise" INTEGER NOT NULL DEFAULT 0,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppCostLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PatientWhatsAppConsent_patientId_key" ON "PatientWhatsAppConsent"("patientId");

-- CreateIndex
CREATE INDEX "PatientWhatsAppConsent_clinicId_status_idx" ON "PatientWhatsAppConsent"("clinicId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PatientWhatsAppConsent_clinicId_patientId_key" ON "PatientWhatsAppConsent"("clinicId", "patientId");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_clinicId_isEnabled_idx" ON "WhatsAppTemplate"("clinicId", "isEnabled");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_clinicId_templateKey_key" ON "WhatsAppTemplate"("clinicId", "templateKey");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_clinicId_patientId_createdAt_idx" ON "WhatsAppMessage"("clinicId", "patientId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsAppMessage_clinicId_status_createdAt_idx" ON "WhatsAppMessage"("clinicId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsAppMessage_clinicId_conversationId_createdAt_idx" ON "WhatsAppMessage"("clinicId", "conversationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "WhatsAppMessage_providerMessageId_idx" ON "WhatsAppMessage"("providerMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_clinicId_idempotencyKey_key" ON "WhatsAppMessage"("clinicId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "PatientConversation_patientId_key" ON "PatientConversation"("patientId");

-- CreateIndex
CREATE INDEX "PatientConversation_clinicId_status_lastMessageAt_idx" ON "PatientConversation"("clinicId", "status", "lastMessageAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PatientConversation_clinicId_patientId_key" ON "PatientConversation"("clinicId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppCostLog_clinicId_year_month_key" ON "WhatsAppCostLog"("clinicId", "year", "month");

-- AddForeignKey
ALTER TABLE "PatientWhatsAppConsent" ADD CONSTRAINT "PatientWhatsAppConsent_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientWhatsAppConsent" ADD CONSTRAINT "PatientWhatsAppConsent_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "WhatsAppTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "PatientConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConversation" ADD CONSTRAINT "PatientConversation_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientConversation" ADD CONSTRAINT "PatientConversation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppCostLog" ADD CONSTRAINT "WhatsAppCostLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

