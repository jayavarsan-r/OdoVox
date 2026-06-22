import { z } from 'zod';
import { FdiToothNumber, IndianPhone, LabCaseStatus, Timestamps } from './common.js';

export const CreateLabPartnerInput = z.object({
  name: z.string().min(1).max(160),
  contact: IndianPhone,
  address: z.string().max(500).optional(),
});
export type CreateLabPartnerInput = z.infer<typeof CreateLabPartnerInput>;

export const LabPartnerResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    name: z.string(),
    contact: z.string(),
    address: z.string().nullable(),
  })
  .merge(Timestamps);
export type LabPartnerResponse = z.infer<typeof LabPartnerResponse>;

export const CreateLabCaseInput = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  partnerId: z.string().min(1).optional(),
  caseType: z.string().min(1).max(160),
  toothNumbers: z.array(FdiToothNumber).default([]),
  notes: z.string().max(2000).optional(),
  expectedDate: z.coerce.date().optional(),
});
export type CreateLabCaseInput = z.infer<typeof CreateLabCaseInput>;

export const UpdateLabCaseInput = z.object({
  status: LabCaseStatus.optional(),
  partnerId: z.string().min(1).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  expectedDate: z.coerce.date().nullable().optional(),
  actualDate: z.coerce.date().nullable().optional(),
});
export type UpdateLabCaseInput = z.infer<typeof UpdateLabCaseInput>;

export const LabCaseResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    patientId: z.string(),
    doctorId: z.string(),
    partnerId: z.string().nullable(),
    caseType: z.string(),
    toothNumbers: z.array(FdiToothNumber),
    status: LabCaseStatus,
    notes: z.string().nullable(),
    expectedDate: z.coerce.date().nullable(),
    actualDate: z.coerce.date().nullable(),
  })
  .merge(Timestamps);
export type LabCaseResponse = z.infer<typeof LabCaseResponse>;
