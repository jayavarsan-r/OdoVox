import { z } from 'zod';
import {
  FdiToothNumber,
  IndianPhone,
  LabCaseStatus,
  LabCaseType,
  PaiseAmount,
  Timestamps,
} from './common.js';

// ===========================================================================
// Lab vendors
// ===========================================================================

export const CreateLabVendorInput = z.object({
  name: z.string().min(1).max(160),
  contactPhone: IndianPhone,
  contactPersonName: z.string().max(160).optional(),
  address: z.string().max(500).optional(),
  email: z.string().email().max(160).optional(),
  defaultTurnaroundDays: z.number().int().min(1).max(120).default(7),
  specialties: z.array(z.string().min(1).max(40)).max(20).default([]),
  notes: z.string().max(2000).optional(),
});
export type CreateLabVendorInput = z.infer<typeof CreateLabVendorInput>;

export const UpdateLabVendorInput = CreateLabVendorInput.partial();
export type UpdateLabVendorInput = z.infer<typeof UpdateLabVendorInput>;

export const LabVendorResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    name: z.string(),
    // Masked by default in list; full value only returned on detail reads (audited).
    contactPhone: z.string().nullable(),
    contactPersonName: z.string().nullable(),
    address: z.string().nullable(),
    email: z.string().nullable(),
    defaultTurnaroundDays: z.number().int(),
    specialties: z.array(z.string()),
    notes: z.string().nullable(),
    isArchived: z.boolean(),
    createdById: z.string(),
  })
  .merge(Timestamps.omit({ deletedAt: true }));
export type LabVendorResponse = z.infer<typeof LabVendorResponse>;

// ===========================================================================
// Lab cases
// ===========================================================================

export const CreateLabCaseInput = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1).optional(), // defaults to current user
  vendorId: z.string().min(1),
  type: LabCaseType,
  teeth: z.array(FdiToothNumber).default([]),
  material: z.string().max(120).optional(),
  shade: z.string().max(40).optional(),
  description: z.string().max(2000).optional(),
  impressionTakenAt: z.coerce.date().optional(),
  expectedReturnAt: z.coerce.date().optional(),
  costPaise: PaiseAmount.optional(),
  patientChargePaise: PaiseAmount.optional(),
  notes: z.string().max(4000).optional(),
  treatmentPlanId: z.string().min(1).optional(),
  visitId: z.string().min(1).optional(),
});
export type CreateLabCaseInput = z.infer<typeof CreateLabCaseInput>;

// Only DRAFT/SENT cases may be edited (enforced server-side).
export const UpdateLabCaseInput = z.object({
  vendorId: z.string().min(1).optional(),
  type: LabCaseType.optional(),
  teeth: z.array(FdiToothNumber).optional(),
  material: z.string().max(120).nullable().optional(),
  shade: z.string().max(40).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
  impressionTakenAt: z.coerce.date().nullable().optional(),
  expectedReturnAt: z.coerce.date().nullable().optional(),
  costPaise: PaiseAmount.nullable().optional(),
  patientChargePaise: PaiseAmount.nullable().optional(),
  notes: z.string().max(4000).nullable().optional(),
  treatmentPlanId: z.string().min(1).nullable().optional(),
  visitId: z.string().min(1).nullable().optional(),
});
export type UpdateLabCaseInput = z.infer<typeof UpdateLabCaseInput>;

// --- Transition action bodies ---------------------------------------------

export const SendLabCaseInput = z.object({
  sentAt: z.coerce.date().optional(),
  expectedReturnAt: z.coerce.date().optional(),
});
export type SendLabCaseInput = z.infer<typeof SendLabCaseInput>;

export const ConfirmReceivedLabCaseInput = z.object({
  confirmedAt: z.coerce.date().optional(),
});
export type ConfirmReceivedLabCaseInput = z.infer<typeof ConfirmReceivedLabCaseInput>;

export const ReceiveLabCaseInput = z.object({
  returnedAt: z.coerce.date().optional(),
  costPaise: PaiseAmount.optional(),
});
export type ReceiveLabCaseInput = z.infer<typeof ReceiveLabCaseInput>;

export const DeliverLabCaseInput = z.object({
  deliveredAt: z.coerce.date().optional(),
  patientChargePaise: PaiseAmount.optional(),
  requireRework: z.boolean().default(false),
  reworkReason: z.string().max(1000).optional(),
});
export type DeliverLabCaseInput = z.infer<typeof DeliverLabCaseInput>;

export const ReworkLabCaseInput = z.object({
  reason: z.string().min(1).max(1000),
});
export type ReworkLabCaseInput = z.infer<typeof ReworkLabCaseInput>;

export const CompleteLabCaseInput = z.object({
  completedAt: z.coerce.date().optional(),
});
export type CompleteLabCaseInput = z.infer<typeof CompleteLabCaseInput>;

export const CancelLabCaseInput = z.object({
  reason: z.string().min(1).max(1000),
});
export type CancelLabCaseInput = z.infer<typeof CancelLabCaseInput>;

// --- Query ------------------------------------------------------------------

export const ListLabCasesQuery = z.object({
  status: LabCaseStatus.optional(),
  vendorId: z.string().optional(),
  patientId: z.string().optional(),
  search: z.string().max(120).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListLabCasesQuery = z.infer<typeof ListLabCasesQuery>;

// --- Responses --------------------------------------------------------------

export const LabCasePhoto = z.object({
  id: z.string(),
  url: z.string().nullable(),
  thumbnailKey: z.string().nullable(),
  mimeType: z.string(),
  uploadedAt: z.coerce.date(),
});
export type LabCasePhoto = z.infer<typeof LabCasePhoto>;

// Compact row for lists, patient Cases tab, realtime broadcasts.
export const LabCaseSummary = z.object({
  id: z.string(),
  clinicId: z.string(),
  caseNumber: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  doctorId: z.string(),
  vendorId: z.string(),
  vendorName: z.string().nullable(),
  type: LabCaseType,
  teeth: z.array(FdiToothNumber),
  material: z.string().nullable(),
  shade: z.string().nullable(),
  status: LabCaseStatus,
  expectedReturnAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});
export type LabCaseSummary = z.infer<typeof LabCaseSummary>;

export const LabPhotoPresignInput = z.object({
  mimeType: z.string().min(1).max(100),
});
export type LabPhotoPresignInput = z.infer<typeof LabPhotoPresignInput>;

export const AttachLabPhotoInput = z.object({
  storageKey: z.string().min(1),
  mimeType: z.string().min(1).max(100),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  thumbnailKey: z.string().optional(),
});
export type AttachLabPhotoInput = z.infer<typeof AttachLabPhotoInput>;

export const LabCaseResponse = LabCaseSummary.extend({
  description: z.string().nullable(),
  impressionTakenAt: z.coerce.date().nullable(),
  sentAt: z.coerce.date().nullable(),
  returnedAt: z.coerce.date().nullable(),
  deliveredAt: z.coerce.date().nullable(),
  completedAt: z.coerce.date().nullable(),
  rejectionReason: z.string().nullable(),
  costPaise: z.number().int().nullable(),
  patientChargePaise: z.number().int().nullable(),
  notes: z.string().nullable(), // decrypted notesEnc
  treatmentPlanId: z.string().nullable(),
  visitId: z.string().nullable(),
  reworkOfId: z.string().nullable(),
  createdById: z.string(),
  updatedAt: z.coerce.date(),
  photos: z.array(LabCasePhoto),
});
export type LabCaseResponse = z.infer<typeof LabCaseResponse>;
