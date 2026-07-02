import { z } from 'zod';

/**
 * Shared primitives, brands, enums, and pagination shapes.
 * These are the single source of truth — Prisma enums mirror these string unions by hand,
 * and a unit test (or future codegen) keeps them aligned.
 */

// ---------------------------------------------------------------------------
// Branded IDs — cuid strings, branded per-entity to prevent mixing them up.
// ---------------------------------------------------------------------------
export const Cuid = z.string().cuid2().or(z.string().min(1)); // accept cuid()/cuid2 during transition

export const UserId = z.string().min(1).brand<'UserId'>();
export const ClinicId = z.string().min(1).brand<'ClinicId'>();
export const PatientId = z.string().min(1).brand<'PatientId'>();
export const VisitId = z.string().min(1).brand<'VisitId'>();

export type UserId = z.infer<typeof UserId>;
export type ClinicId = z.infer<typeof ClinicId>;
export type PatientId = z.infer<typeof PatientId>;
export type VisitId = z.infer<typeof VisitId>;

// ---------------------------------------------------------------------------
// India-region primitives.
// ---------------------------------------------------------------------------

/** 10-digit Indian mobile, first digit 6-9 (no +91 prefix stored). */
export const IndianPhone = z
  .string()
  .regex(/^[6-9]\d{9}$/, 'Must be a 10-digit Indian mobile number');
export type IndianPhone = z.infer<typeof IndianPhone>;

/** 6-digit Indian PIN code. */
export const Pincode = z.string().regex(/^\d{6}$/, 'Must be a 6-digit PIN code');

/** 15-character GSTIN. */
export const Gstin = z
  .string()
  .regex(
    /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/,
    'Invalid GSTIN',
  );

/** Money is always stored as paise: non-negative integers. Never floats. */
export const PaiseAmount = z
  .number()
  .int('Money must be in integer paise')
  .nonnegative('Money cannot be negative');
export type PaiseAmount = z.infer<typeof PaiseAmount>;

/**
 * FDI tooth numbering (permanent dentition): quadrant 1-4, tooth 1-8 → 11..48.
 * Stored as an integer.
 */
export const FdiToothNumber = z
  .number()
  .int()
  .refine((n) => /^[1-4][1-8]$/.test(String(n)), 'Invalid FDI tooth number (expected 11-48)');
export type FdiToothNumber = z.infer<typeof FdiToothNumber>;

// ---------------------------------------------------------------------------
// Pagination (cursor-based).
// ---------------------------------------------------------------------------
export const Pagination = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});
export type Pagination = z.infer<typeof Pagination>;

export const paginatedResponse = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });

// ---------------------------------------------------------------------------
// Timestamps mixin (responses).
// ---------------------------------------------------------------------------
export const Timestamps = z.object({
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  deletedAt: z.coerce.date().nullable().optional(),
});
export type Timestamps = z.infer<typeof Timestamps>;

// ---------------------------------------------------------------------------
// Shared enums — mirrored in prisma/schema.prisma.
// ---------------------------------------------------------------------------
export const MemberRole = z.enum(['DOCTOR', 'RECEPTIONIST', 'ADMIN']);
export type MemberRole = z.infer<typeof MemberRole>;

export const MemberStatus = z.enum(['ACTIVE', 'INACTIVE', 'PENDING']);
export type MemberStatus = z.infer<typeof MemberStatus>;

export const PatientStatus = z.enum([
  'NEW',
  'ACTIVE',
  'IN_CHAIR',
  'DUE_PAYMENT',
  'LAB_PENDING',
  'INACTIVE',
]);
export type PatientStatus = z.infer<typeof PatientStatus>;

export const Gender = z.enum(['MALE', 'FEMALE', 'OTHER']);
export type Gender = z.infer<typeof Gender>;

export const VisitStatus = z.enum([
  'SCHEDULED',
  'CHECKED_IN',
  'WAITING',
  'IN_CHAIR',
  'CHECKOUT',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);
export type VisitStatus = z.infer<typeof VisitStatus>;

export const RoomStatus = z.enum(['AVAILABLE', 'OCCUPIED', 'OFFLINE']);
export type RoomStatus = z.infer<typeof RoomStatus>;

export const QueueEventType = z.enum([
  'CHECKED_IN',
  'CALLED_IN',
  'RETURNED_TO_QUEUE',
  'CHECKOUT_STARTED',
  'COMPLETED',
  'CANCELLED',
  'REASSIGNED',
  'PRIORITY_CHANGED',
  'DOCTOR_RECORDING',
  'DOCTOR_RECORDING_DONE',
]);
export type QueueEventType = z.infer<typeof QueueEventType>;

export const ConsultationStatus = z.enum(['PENDING_REVIEW', 'CONFIRMED', 'REJECTED']);
export type ConsultationStatus = z.infer<typeof ConsultationStatus>;

export const PlanStatus = z.enum(['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED']);
export type PlanStatus = z.infer<typeof PlanStatus>;

export const ProcedureStatus = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);
export type ProcedureStatus = z.infer<typeof ProcedureStatus>;

export const ToothStatus = z.enum([
  'HEALTHY',
  'CARIES',
  'FILLED',
  'EXTRACTED',
  'CROWN',
  'RCT',
  'IMPLANT',
  'MISSING',
  'OTHER',
]);
export type ToothStatus = z.infer<typeof ToothStatus>;

export const AppointmentStatus = z.enum([
  'SCHEDULED',
  'CHECKED_IN',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatus>;

export const ReminderStatus = z.enum(['PENDING', 'SENT', 'FAILED', 'CANCELLED']);
export type ReminderStatus = z.infer<typeof ReminderStatus>;

export const DayOffScope = z.enum(['CLINIC', 'DOCTOR']);
export type DayOffScope = z.infer<typeof DayOffScope>;

export const RecurringInterval = z.enum(['WEEKLY', 'BIWEEKLY', 'MONTHLY']);
export type RecurringInterval = z.infer<typeof RecurringInterval>;

// Phase 7 lab-case lifecycle, extended by the Phase 9.7 WhatsApp tracker. Legacy Phase 7 values
// (DELIVERED / RETURNED_FOR_REWORK / COMPLETED) stay valid for existing data.
export const LabCaseStatus = z.enum([
  'DRAFT',
  'SENT',
  'ACKNOWLEDGED',
  'IN_PROGRESS',
  'READY',
  'DISPATCHED',
  'RECEIVED',
  'FITTED',
  'ISSUE_RAISED',
  'DELIVERED',
  'RETURNED_FOR_REWORK',
  'COMPLETED',
  'CANCELLED',
]);
export type LabCaseStatus = z.infer<typeof LabCaseStatus>;

// Phase 9.7 — who/what moved a lab case (LabCase.statusUpdatedBy + LabCaseEvent.trigger).
export const LabTransitionTrigger = z.enum([
  'lab_button',
  'lab_text',
  'llm_parse',
  'reception_manual',
  'reception_voice',
  'timeout_job',
]);
export type LabTransitionTrigger = z.infer<typeof LabTransitionTrigger>;

export const LabCaseType = z.enum([
  'CROWN',
  'BRIDGE',
  'DENTURE_FULL',
  'DENTURE_PARTIAL',
  'ALIGNER',
  'NIGHT_GUARD',
  'OCCLUSAL_SPLINT',
  'VENEER',
  'INLAY_ONLAY',
  'RPD',
  'OTHER',
]);
export type LabCaseType = z.infer<typeof LabCaseType>;

// Phase 7 — signed inventory stock movements.
export const MovementKind = z.enum(['PURCHASE', 'CONSUMPTION', 'ADJUSTMENT', 'DISPOSAL_EXPIRED']);
export type MovementKind = z.infer<typeof MovementKind>;

export const BillStatus = z.enum(['DRAFT', 'FINALIZED', 'PARTIAL', 'PAID', 'REFUNDED', 'CANCELLED']);
export type BillStatus = z.infer<typeof BillStatus>;

export const ItemKind = z.enum(['PROCEDURE', 'LAB_CHARGE', 'MATERIAL', 'ADJUSTMENT', 'OTHER']);
export type ItemKind = z.infer<typeof ItemKind>;

export const PaymentMethod = z.enum([
  'CASH',
  'UPI_MANUAL',
  'CARD_MANUAL',
  'BANK_TRANSFER',
  'RAZORPAY',
  'ADJUSTMENT',
]);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PaymentStatus = z.enum([
  'PENDING',
  'SUCCEEDED',
  'FAILED',
  'REFUNDED',
  'PARTIAL_REFUND',
  'CANCELLED',
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const RefundStatus = z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED']);
export type RefundStatus = z.infer<typeof RefundStatus>;

export const MediaType = z.enum(['XRAY', 'PHOTO', 'DOCUMENT', 'LAB_PHOTO']);
export type MediaType = z.infer<typeof MediaType>;
