import { z } from 'zod';
import { Timestamps } from './common.js';

export const Medicine = z.object({
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  durationDays: z.number().int().min(1),
  instructions: z.string().optional(),
});
export type Medicine = z.infer<typeof Medicine>;

export const CreatePrescriptionInput = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  doctorId: z.string().min(1),
  medicines: z.array(Medicine).min(1),
  instructions: z.string().max(2000).optional(),
  reviewAfterDays: z.number().int().min(0).optional(),
});
export type CreatePrescriptionInput = z.infer<typeof CreatePrescriptionInput>;

export const PrescriptionResponse = z
  .object({
    id: z.string(),
    patientId: z.string(),
    visitId: z.string().nullable(),
    doctorId: z.string(),
    medicines: z.array(Medicine),
    instructions: z.string().nullable(),
    reviewAfterDays: z.number().int().nullable(),
    pdfUrl: z.string().nullable(),
  })
  .merge(Timestamps);
export type PrescriptionResponse = z.infer<typeof PrescriptionResponse>;
