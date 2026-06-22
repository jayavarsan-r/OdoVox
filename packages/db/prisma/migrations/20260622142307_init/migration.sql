-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('DOCTOR', 'RECEPTIONIST', 'ADMIN');

-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'PENDING');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "VisitStatus" AS ENUM ('WAITING', 'IN_CHAIR', 'CHECKOUT', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ConsultationStatus" AS ENUM ('PENDING_REVIEW', 'CONFIRMED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcedureStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ToothStatus" AS ENUM ('HEALTHY', 'CARIES', 'FILLED', 'EXTRACTED', 'CROWN', 'RCT', 'IMPLANT', 'MISSING', 'OTHER');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'RESCHEDULED');

-- CreateEnum
CREATE TYPE "AvailabilityType" AS ENUM ('DAY_OFF', 'HALF_DAY_OFF', 'HOUR_BLOCK');

-- CreateEnum
CREATE TYPE "LabCaseStatus" AS ENUM ('CREATED', 'ASSIGNED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'FITTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InventoryCategory" AS ENUM ('MEDICINE', 'CONSUMABLE', 'INSTRUMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUST');

-- CreateEnum
CREATE TYPE "BillStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('XRAY', 'PHOTO', 'DOCUMENT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "profilePhotoUrl" TEXT,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "addressLine" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "gstNumber" TEXT,
    "logoUrl" TEXT,
    "contactPhone" TEXT NOT NULL,
    "openingTime" TEXT NOT NULL,
    "closingTime" TEXT NOT NULL,
    "lunchStart" TEXT,
    "lunchEnd" TEXT,
    "weeklyOffDays" INTEGER[],
    "chairsCount" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicMember" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL,
    "qualification" TEXT,
    "registrationNumber" TEXT,
    "specialization" TEXT,
    "status" "MemberStatus" NOT NULL DEFAULT 'PENDING',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpRequest" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otpHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "ip" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OtpRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "deviceInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "gender" "Gender" NOT NULL,
    "bloodGroup" TEXT,
    "address" TEXT,
    "medicalHistoryEnc" TEXT,
    "allergiesEnc" TEXT,
    "medicalFlags" TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visit" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "roomId" TEXT,
    "status" "VisitStatus" NOT NULL DEFAULT 'WAITING',
    "tokenNumber" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "chiefComplaint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "rawTranscript" TEXT,
    "structuredData" JSONB NOT NULL DEFAULT '{}',
    "audioUrl" TEXT,
    "status" "ConsultationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "confirmedAt" TIMESTAMP(3),
    "confirmedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationEdit" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "originalValue" TEXT NOT NULL,
    "editedValue" TEXT NOT NULL,
    "editedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TreatmentPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedCostPaise" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "TreatmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "toothNumbers" INTEGER[],
    "totalSittings" INTEGER NOT NULL DEFAULT 1,
    "completedSittings" INTEGER NOT NULL DEFAULT 0,
    "status" "ProcedureStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sitting" (
    "id" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "visitId" TEXT,
    "sittingNumber" INTEGER NOT NULL,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sitting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ToothRecord" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "toothNumber" INTEGER NOT NULL,
    "status" "ToothStatus" NOT NULL DEFAULT 'HEALTHY',
    "history" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ToothRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Prescription" (
    "id" TEXT NOT NULL,
    "visitId" TEXT,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "medicines" JSONB NOT NULL DEFAULT '[]',
    "instructions" TEXT,
    "reviewAfterDays" INTEGER,
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Prescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "procedureType" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    "parentAppointmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DoctorAvailability" (
    "id" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "type" "AvailabilityType" NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DoctorAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabPartner" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabCase" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "doctorId" TEXT NOT NULL,
    "partnerId" TEXT,
    "caseType" TEXT NOT NULL,
    "toothNumbers" INTEGER[],
    "status" "LabCaseStatus" NOT NULL DEFAULT 'CREATED',
    "notes" TEXT,
    "expectedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "LabCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LabCaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "status" "LabCaseStatus" NOT NULL,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LabCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "InventoryCategory" NOT NULL,
    "unit" TEXT NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lowStockThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "trackExpiry" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "batchNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bill" (
    "id" TEXT NOT NULL,
    "visitId" TEXT,
    "patientId" TEXT NOT NULL,
    "items" JSONB NOT NULL DEFAULT '[]',
    "totalPaise" INTEGER NOT NULL DEFAULT 0,
    "paidPaise" INTEGER NOT NULL DEFAULT 0,
    "status" "BillStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amountPaise" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "receivedById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Media" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitId" TEXT,
    "type" "MediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "notes" TEXT,
    "uploadedById" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clinicId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicSetting" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_joinCode_key" ON "Clinic"("joinCode");

-- CreateIndex
CREATE INDEX "Clinic_joinCode_idx" ON "Clinic"("joinCode");

-- CreateIndex
CREATE INDEX "ClinicMember_clinicId_idx" ON "ClinicMember"("clinicId");

-- CreateIndex
CREATE INDEX "ClinicMember_userId_idx" ON "ClinicMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicMember_clinicId_userId_key" ON "ClinicMember"("clinicId", "userId");

-- CreateIndex
CREATE INDEX "OtpRequest_phone_idx" ON "OtpRequest"("phone");

-- CreateIndex
CREATE INDEX "OtpRequest_expiresAt_idx" ON "OtpRequest"("expiresAt");

-- CreateIndex
CREATE INDEX "AuditLog_clinicId_createdAt_idx" ON "AuditLog"("clinicId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");

-- CreateIndex
CREATE INDEX "Room_clinicId_idx" ON "Room"("clinicId");

-- CreateIndex
CREATE INDEX "Patient_clinicId_name_idx" ON "Patient"("clinicId", "name");

-- CreateIndex
CREATE INDEX "Patient_clinicId_phone_idx" ON "Patient"("clinicId", "phone");

-- CreateIndex
CREATE INDEX "Patient_createdById_idx" ON "Patient"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_clinicId_patientCode_key" ON "Patient"("clinicId", "patientCode");

-- CreateIndex
CREATE INDEX "Visit_clinicId_status_createdAt_idx" ON "Visit"("clinicId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Visit_patientId_idx" ON "Visit"("patientId");

-- CreateIndex
CREATE INDEX "Visit_doctorId_idx" ON "Visit"("doctorId");

-- CreateIndex
CREATE INDEX "Visit_roomId_idx" ON "Visit"("roomId");

-- CreateIndex
CREATE UNIQUE INDEX "Consultation_visitId_key" ON "Consultation"("visitId");

-- CreateIndex
CREATE INDEX "Consultation_visitId_idx" ON "Consultation"("visitId");

-- CreateIndex
CREATE INDEX "Consultation_status_idx" ON "Consultation"("status");

-- CreateIndex
CREATE INDEX "ConsultationEdit_consultationId_idx" ON "ConsultationEdit"("consultationId");

-- CreateIndex
CREATE INDEX "ConsultationEdit_editedById_idx" ON "ConsultationEdit"("editedById");

-- CreateIndex
CREATE INDEX "TreatmentPlan_patientId_idx" ON "TreatmentPlan"("patientId");

-- CreateIndex
CREATE INDEX "TreatmentPlan_status_idx" ON "TreatmentPlan"("status");

-- CreateIndex
CREATE INDEX "Procedure_planId_idx" ON "Procedure"("planId");

-- CreateIndex
CREATE INDEX "Sitting_procedureId_idx" ON "Sitting"("procedureId");

-- CreateIndex
CREATE INDEX "Sitting_visitId_idx" ON "Sitting"("visitId");

-- CreateIndex
CREATE INDEX "ToothRecord_patientId_idx" ON "ToothRecord"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "ToothRecord_patientId_toothNumber_key" ON "ToothRecord"("patientId", "toothNumber");

-- CreateIndex
CREATE INDEX "Prescription_visitId_idx" ON "Prescription"("visitId");

-- CreateIndex
CREATE INDEX "Prescription_patientId_idx" ON "Prescription"("patientId");

-- CreateIndex
CREATE INDEX "Prescription_doctorId_idx" ON "Prescription"("doctorId");

-- CreateIndex
CREATE INDEX "Appointment_clinicId_scheduledAt_idx" ON "Appointment"("clinicId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_doctorId_scheduledAt_idx" ON "Appointment"("doctorId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Appointment_patientId_idx" ON "Appointment"("patientId");

-- CreateIndex
CREATE INDEX "Appointment_parentAppointmentId_idx" ON "Appointment"("parentAppointmentId");

-- CreateIndex
CREATE INDEX "DoctorAvailability_doctorId_date_idx" ON "DoctorAvailability"("doctorId", "date");

-- CreateIndex
CREATE INDEX "LabPartner_clinicId_idx" ON "LabPartner"("clinicId");

-- CreateIndex
CREATE INDEX "LabCase_clinicId_status_idx" ON "LabCase"("clinicId", "status");

-- CreateIndex
CREATE INDEX "LabCase_patientId_idx" ON "LabCase"("patientId");

-- CreateIndex
CREATE INDEX "LabCase_doctorId_idx" ON "LabCase"("doctorId");

-- CreateIndex
CREATE INDEX "LabCase_partnerId_idx" ON "LabCase"("partnerId");

-- CreateIndex
CREATE INDEX "LabCaseEvent_caseId_idx" ON "LabCaseEvent"("caseId");

-- CreateIndex
CREATE INDEX "LabCaseEvent_createdById_idx" ON "LabCaseEvent"("createdById");

-- CreateIndex
CREATE INDEX "InventoryItem_clinicId_idx" ON "InventoryItem"("clinicId");

-- CreateIndex
CREATE INDEX "InventoryItem_clinicId_category_idx" ON "InventoryItem"("clinicId", "category");

-- CreateIndex
CREATE INDEX "InventoryMovement_itemId_idx" ON "InventoryMovement"("itemId");

-- CreateIndex
CREATE INDEX "InventoryMovement_createdById_idx" ON "InventoryMovement"("createdById");

-- CreateIndex
CREATE INDEX "Bill_visitId_idx" ON "Bill"("visitId");

-- CreateIndex
CREATE INDEX "Bill_patientId_idx" ON "Bill"("patientId");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Payment_billId_idx" ON "Payment"("billId");

-- CreateIndex
CREATE INDEX "Payment_receivedById_idx" ON "Payment"("receivedById");

-- CreateIndex
CREATE INDEX "Media_patientId_idx" ON "Media"("patientId");

-- CreateIndex
CREATE INDEX "Media_visitId_idx" ON "Media"("visitId");

-- CreateIndex
CREATE INDEX "Media_uploadedById_idx" ON "Media"("uploadedById");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_clinicId_idx" ON "Notification"("clinicId");

-- CreateIndex
CREATE INDEX "Notification_readAt_idx" ON "Notification"("readAt");

-- CreateIndex
CREATE INDEX "ClinicSetting_clinicId_idx" ON "ClinicSetting"("clinicId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicSetting_clinicId_key_key" ON "ClinicSetting"("clinicId", "key");

-- AddForeignKey
ALTER TABLE "ClinicMember" ADD CONSTRAINT "ClinicMember_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicMember" ADD CONSTRAINT "ClinicMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visit" ADD CONSTRAINT "Visit_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_confirmedById_fkey" FOREIGN KEY ("confirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationEdit" ADD CONSTRAINT "ConsultationEdit_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationEdit" ADD CONSTRAINT "ConsultationEdit_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sitting" ADD CONSTRAINT "Sitting_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sitting" ADD CONSTRAINT "Sitting_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothRecord" ADD CONSTRAINT "ToothRecord_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_parentAppointmentId_fkey" FOREIGN KEY ("parentAppointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorAvailability" ADD CONSTRAINT "DoctorAvailability_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabPartner" ADD CONSTRAINT "LabPartner_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCase" ADD CONSTRAINT "LabCase_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCase" ADD CONSTRAINT "LabCase_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCase" ADD CONSTRAINT "LabCase_doctorId_fkey" FOREIGN KEY ("doctorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCase" ADD CONSTRAINT "LabCase_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "LabPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCaseEvent" ADD CONSTRAINT "LabCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "LabCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LabCaseEvent" ADD CONSTRAINT "LabCaseEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bill" ADD CONSTRAINT "Bill_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_billId_fkey" FOREIGN KEY ("billId") REFERENCES "Bill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Media" ADD CONSTRAINT "Media_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicSetting" ADD CONSTRAINT "ClinicSetting_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
