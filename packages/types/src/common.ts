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
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
  'RESCHEDULED',
]);
export type AppointmentStatus = z.infer<typeof AppointmentStatus>;

export const AvailabilityType = z.enum(['DAY_OFF', 'HALF_DAY_OFF', 'HOUR_BLOCK']);
export type AvailabilityType = z.infer<typeof AvailabilityType>;

export const LabCaseStatus = z.enum([
  'CREATED',
  'ASSIGNED',
  'IN_PROGRESS',
  'READY',
  'DELIVERED',
  'FITTED',
  'REJECTED',
]);
export type LabCaseStatus = z.infer<typeof LabCaseStatus>;

export const InventoryCategory = z.enum(['MEDICINE', 'CONSUMABLE', 'INSTRUMENT', 'OTHER']);
export type InventoryCategory = z.infer<typeof InventoryCategory>;

export const MovementType = z.enum(['IN', 'OUT', 'ADJUST']);
export type MovementType = z.infer<typeof MovementType>;

export const BillStatus = z.enum(['PENDING', 'PARTIAL', 'PAID', 'REFUNDED']);
export type BillStatus = z.infer<typeof BillStatus>;

export const PaymentMethod = z.enum(['CASH', 'UPI', 'CARD', 'OTHER']);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const MediaType = z.enum(['XRAY', 'PHOTO', 'DOCUMENT']);
export type MediaType = z.infer<typeof MediaType>;
