import { z } from 'zod';
import { Gender, ToothStatus } from './common.js';

/**
 * Structured output of the AI extractors. These are the schemas the verification card edits and
 * the confirm endpoint commits — the single source of truth shared by API and web.
 *
 * Design note: tooth numbers here are plain integers (NOT FdiToothNumber). An out-of-range tooth
 * like 19 must survive parsing so the safety layer can surface it as a blocking error on the card,
 * rather than Zod silently rejecting the whole extraction.
 */

export const MedicineFrequency = z.enum(['OD', 'BD', 'TID', 'QID', 'SOS']);
export type MedicineFrequency = z.infer<typeof MedicineFrequency>;

/** Today's status of the procedure as the doctor spoke it. */
export const ExtractionProcedureStatus = z.enum(['IN_PROGRESS', 'COMPLETED', 'ABORTED']);
export type ExtractionProcedureStatus = z.infer<typeof ExtractionProcedureStatus>;

export const ExtractedPrescription = z.object({
  name: z.string().min(1),
  dosage: z.string().nullable().default(null),
  frequency: MedicineFrequency.nullable().default(null),
  durationDays: z.number().int().positive().nullable().default(null),
  instructions: z.string().nullable().default(null),
});
export type ExtractedPrescription = z.infer<typeof ExtractedPrescription>;

export const ExtractedFollowUp = z.object({
  afterDays: z.number().int().positive().nullable().default(null),
  procedureHint: z.string().nullable().default(null),
});
export type ExtractedFollowUp = z.infer<typeof ExtractedFollowUp>;

export const ExtractedToothStatusUpdate = z.object({
  tooth: z.number().int(),
  status: ToothStatus,
  note: z.string().nullable().default(null),
});
export type ExtractedToothStatusUpdate = z.infer<typeof ExtractedToothStatusUpdate>;

export const ClinicalExtraction = z.object({
  procedure: z.string().nullable().default(null),
  teeth: z.array(z.number().int()).default([]),
  sittingCurrent: z.number().int().nullable().default(null),
  sittingTotal: z.number().int().nullable().default(null),
  status: ExtractionProcedureStatus.nullable().default(null),
  prescriptions: z.array(ExtractedPrescription).default([]),
  followUp: ExtractedFollowUp.nullable().default(null),
  toothStatusUpdates: z.array(ExtractedToothStatusUpdate).default([]),
  notes: z.string().nullable().default(null),
  clarifications: z.array(z.string()).default([]),
  safetyWarnings: z.array(z.string()).default([]),
});
export type ClinicalExtraction = z.infer<typeof ClinicalExtraction>;

/** Medicines-only extraction (Dictate prescription flow). */
export const PrescriptionExtraction = z.object({
  prescriptions: z.array(ExtractedPrescription).default([]),
  clarifications: z.array(z.string()).default([]),
  safetyWarnings: z.array(z.string()).default([]),
});
export type PrescriptionExtraction = z.infer<typeof PrescriptionExtraction>;

/** Demographics + chief complaint (Speak patient details flow). */
export const PatientIntakeExtraction = z.object({
  name: z.string().nullable().default(null),
  phone: z.string().nullable().default(null),
  age: z.number().int().positive().nullable().default(null),
  gender: Gender.nullable().default(null),
  chiefComplaint: z.string().nullable().default(null),
  medicalFlags: z.array(z.string()).default([]),
  clarifications: z.array(z.string()).default([]),
});
export type PatientIntakeExtraction = z.infer<typeof PatientIntakeExtraction>;

// ---------------------------------------------------------------------------
// Extraction context — patient metadata fed to the prompt (never echoed to output).
// ---------------------------------------------------------------------------

export interface ClinicalExtractionContext {
  name: string;
  age: number | null;
  gender: string | null;
  allergies: string[];
  medicalFlags: string[];
  currentPlanSummary: string | null;
  lastVisitSummary: string | null;
  chiefComplaint: string | null;
}

export interface PrescriptionContext {
  name: string;
  age: number | null;
  allergies: string[];
  medicalFlags: string[];
}
