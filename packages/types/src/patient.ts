import { z } from 'zod';
import { Gender, IndianPhone, PatientStatus, Timestamps } from './common.js';

const BloodGroup = z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']);

export const PatientBase = z.object({
  name: z.string().min(1).max(120),
  phone: IndianPhone,
  age: z.number().int().min(0).max(120),
  gender: Gender,
  bloodGroup: BloodGroup.nullable().optional(),
  /** PHI — encrypted at rest (addressEnc). */
  address: z.string().max(500).nullable().optional(),
  /** PHI — encrypted at rest (medicalHistoryEnc). */
  medicalHistory: z.string().max(5000).nullable().optional(),
  /** PHI — encrypted at rest (allergiesEnc). */
  allergies: z.string().max(2000).nullable().optional(),
  chiefComplaint: z.string().max(1000).nullable().optional(),
  medicalFlags: z.array(z.string()).default([]),
});

export const CreatePatientInput = PatientBase.extend({
  /** Optional client-suggested code; server validates and falls back to its own. */
  patientCode: z.string().regex(/^PT-[A-Z0-9]{4,8}$/i).optional(),
});
export type CreatePatientInput = z.infer<typeof CreatePatientInput>;

export const UpdatePatientInput = PatientBase.partial().extend({
  status: PatientStatus.optional(),
});
export type UpdatePatientInput = z.infer<typeof UpdatePatientInput>;

/** Patient list filters (mirror the filter pills). */
export const PatientFilter = z.enum(['all', 'in_chair', 'due_today', 'lab_pending', 'recent']);
export type PatientFilter = z.infer<typeof PatientFilter>;

export const PatientListQuery = z.object({
  search: z.string().trim().max(120).optional(),
  filter: PatientFilter.default('all'),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PatientListQuery = z.infer<typeof PatientListQuery>;

/** Lightweight list row — no decrypted PHI. */
export const PatientListItem = z.object({
  id: z.string(),
  patientCode: z.string(),
  name: z.string(),
  phone: z.string(),
  age: z.number().int(),
  gender: Gender,
  status: PatientStatus,
  chiefComplaint: z.string().nullable(),
  medicalFlags: z.array(z.string()),
  outstandingPaise: z.number().int(),
  lastVisitAt: z.coerce.date().nullable(),
});
export type PatientListItem = z.infer<typeof PatientListItem>;

/** Full detail — decrypted PHI included (authorized reads only). */
export const PatientResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    patientCode: z.string(),
    name: z.string(),
    phone: IndianPhone,
    age: z.number().int(),
    gender: Gender,
    bloodGroup: BloodGroup.nullable(),
    address: z.string().nullable(),
    medicalHistory: z.string().nullable(),
    allergies: z.string().nullable(),
    chiefComplaint: z.string().nullable(),
    medicalFlags: z.array(z.string()),
    status: PatientStatus,
    outstandingPaise: z.number().int(),
    lastVisitAt: z.coerce.date().nullable(),
    createdById: z.string(),
  })
  .merge(Timestamps);
export type PatientResponse = z.infer<typeof PatientResponse>;
