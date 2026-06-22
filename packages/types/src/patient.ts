import { z } from 'zod';
import { Gender, IndianPhone, Timestamps } from './common.js';

export const PatientBase = z.object({
  name: z.string().min(1).max(120),
  phone: IndianPhone,
  age: z.number().int().min(0).max(130),
  gender: Gender,
  bloodGroup: z
    .enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'])
    .nullable()
    .optional(),
  address: z.string().max(500).nullable().optional(),
  /** Sensitive — encrypted at rest (AES-256-GCM) before persistence. */
  medicalHistory: z.string().max(5000).nullable().optional(),
  /** Sensitive — encrypted at rest. */
  allergies: z.string().max(2000).nullable().optional(),
  medicalFlags: z.array(z.string()).default([]),
});

export const CreatePatientInput = PatientBase;
export type CreatePatientInput = z.infer<typeof CreatePatientInput>;

export const UpdatePatientInput = PatientBase.partial();
export type UpdatePatientInput = z.infer<typeof UpdatePatientInput>;

export const PatientResponse = PatientBase.extend({
  id: z.string(),
  clinicId: z.string(),
  patientCode: z.string(),
  createdById: z.string(),
}).merge(Timestamps);
export type PatientResponse = z.infer<typeof PatientResponse>;
