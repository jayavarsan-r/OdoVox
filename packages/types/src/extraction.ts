import { z } from 'zod';
import { Gender, LabCaseType, RecurringInterval, ToothStatus } from './common.js';

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

/**
 * Phase 9.7 §2.5.1 — optional lab-case suggestion inside the CLINICAL extraction: the doctor
 * mentioned an impression + a prosthetic timeline ("crown after one week for tooth 26").
 * Never invented; null unless explicitly spoken.
 */
export const LabCaseSuggestion = z.object({
  type: LabCaseType,
  teeth: z.array(z.number().int()).default([]),
  dueInDays: z.number().int().positive().nullable().default(null),
});
export type LabCaseSuggestion = z.infer<typeof LabCaseSuggestion>;

export const ClinicalExtraction = z.object({
  procedure: z.string().nullable().default(null),
  teeth: z.array(z.number().int()).default([]),
  sittingCurrent: z.number().int().nullable().default(null),
  sittingTotal: z.number().int().nullable().default(null),
  // Phase 5: set by the extractor when the transcript continues an existing ACTIVE plan
  // (same procedure + tooth, or an explicit reference like "second sitting"). When set, the
  // confirm transaction advances that plan instead of creating a new one. Null = new plan.
  continuesPlanId: z.string().nullable().default(null),
  status: ExtractionProcedureStatus.nullable().default(null),
  // Phase 8: procedure cost in paise if the doctor dictated one ("five thousand rupees for the RCT"
  // → 500000). Null when not mentioned — never invented. Flows to Procedure.estimatedCostPaise.
  estimatedCostPaise: z.number().int().nullable().default(null),
  prescriptions: z.array(ExtractedPrescription).default([]),
  followUp: ExtractedFollowUp.nullable().default(null),
  toothStatusUpdates: z.array(ExtractedToothStatusUpdate).default([]),
  // Phase 9.7: draft lab case when the doctor spoke an impression + prosthetic timeline.
  labCaseSuggestion: LabCaseSuggestion.nullable().default(null),
  notes: z.string().nullable().default(null),
  clarifications: z.array(z.string()).default([]),
  safetyWarnings: z.array(z.string()).default([]),
});
export type ClinicalExtraction = z.infer<typeof ClinicalExtraction>;

/** Medicines-only extraction (Dictate prescription flow). */
export const PrescriptionExtraction = z.object({
  prescriptions: z.array(ExtractedPrescription).default([]),
  // Phase 5: set when the doctor names a clinic template ("apply RCT pack"). The server populates
  // the template's medicines and merges any explicitly dictated additions. Null = no template.
  applyTemplateId: z.string().nullable().default(null),
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
  // Phase 9.6 Issue 2: spoken allergies ("allergic to penicillin") must reach the patient form —
  // they feed the clinical safety layer on every later prescription.
  allergies: z.array(z.string()).default([]),
  clarifications: z.array(z.string()).default([]),
});
export type PatientIntakeExtraction = z.infer<typeof PatientIntakeExtraction>;

// ---------------------------------------------------------------------------
// Extraction context — patient metadata fed to the prompt (never echoed to output).
// ---------------------------------------------------------------------------

/** A patient's in-progress treatment plan, summarised for the continuation prompt (Phase 5). */
export interface ActivePlanContext {
  planId: string;
  procedureName: string | null;
  teeth: number[];
  completedSittings: number;
  totalSittings: number;
  startedAt: string;
}

export interface ClinicalExtractionContext {
  name: string;
  age: number | null;
  gender: string | null;
  allergies: string[];
  medicalFlags: string[];
  currentPlanSummary: string | null;
  lastVisitSummary: string | null;
  chiefComplaint: string | null;
  /** Phase 5: ACTIVE plans the patient already has — lets the extractor flag continuations. */
  activePlans: ActivePlanContext[];
}

/** A clinic prescription template, named to the prescription prompt so "apply X" resolves to an id. */
export interface TemplateHint {
  id: string;
  name: string;
  tags: string[];
}

export interface PrescriptionContext {
  name: string;
  age: number | null;
  allergies: string[];
  medicalFlags: string[];
  /** Phase 5: the clinic's active templates the doctor can invoke by name. */
  templates: TemplateHint[];
}

// ---------------------------------------------------------------------------
// Phase 9.7 — voice-everywhere extraction schemas. One Zod contract per dictate
// surface; the Gemini responseSchemas in apps/api mirror these.
// ---------------------------------------------------------------------------

/** "Bought 5 boxes of gloves at ₹200 each from Meditrade" → purchase rows. */
export const InventoryPurchaseExtraction = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        unitPricePaise: z.number().int().nonnegative().nullable().default(null),
        batchNumber: z.string().nullable().default(null),
        expiryDate: z.string().nullable().default(null), // ISO date if spoken
        vendorName: z.string().nullable().default(null),
      }),
    )
    .default([]),
  totalCostPaise: z.number().int().nonnegative().nullable().default(null),
  notes: z.string().nullable().default(null),
  clarifications: z.array(z.string()).default([]),
});
export type InventoryPurchaseExtraction = z.infer<typeof InventoryPurchaseExtraction>;

/** "Used 5 gloves and 2 carpules for this filling" → consumption rows. */
export const InventoryConsumeExtraction = z.object({
  items: z.array(z.object({ name: z.string().min(1), quantity: z.number().int().positive() })).default([]),
  procedureName: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  clarifications: z.array(z.string()).default([]),
});
export type InventoryConsumeExtraction = z.infer<typeof InventoryConsumeExtraction>;

/** "Gloves are actually 40, burs 12 — quarterly stock count" → corrected counts (ADMIN). */
export const InventoryAdjustExtraction = z.object({
  items: z.array(z.object({ name: z.string().min(1), newCount: z.number().int().nonnegative() })).default([]),
  reason: z.string().nullable().default(null),
  clarifications: z.array(z.string()).default([]),
});
export type InventoryAdjustExtraction = z.infer<typeof InventoryAdjustExtraction>;

/** "X-ray 300 rupees, scaling 1500, give 10% discount for the senior citizen" → bill lines. */
export const BillItemsExtraction = z.object({
  items: z
    .array(
      z.object({
        description: z.string().min(1),
        quantity: z.number().int().positive().default(1),
        unitPricePaise: z.number().int().nonnegative(),
      }),
    )
    .default([]),
  discountPaise: z.number().int().nonnegative().nullable().default(null),
  discountReason: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  clarifications: z.array(z.string()).default([]),
});
export type BillItemsExtraction = z.infer<typeof BillItemsExtraction>;

/**
 * "Book cleaning for Ramesh with Dr Asha next Monday 10am, every week for 6 weeks" →
 * appointment draft. The extractor returns the raw `dateTimePhrase`; the SERVER resolves it to an
 * ISO instant with chrono-node in the clinic's timezone (LLMs are unreliable at date arithmetic).
 */
export const AppointmentExtraction = z.object({
  patientName: z.string().nullable().default(null),
  doctorName: z.string().nullable().default(null),
  dateTimePhrase: z.string().nullable().default(null),
  durationMinutes: z.number().int().positive().nullable().default(null),
  procedureHint: z.string().nullable().default(null),
  notes: z.string().nullable().default(null),
  isRecurring: z.boolean().default(false),
  recurringInterval: RecurringInterval.nullable().default(null),
  recurringCount: z.number().int().min(2).max(12).nullable().default(null),
  clarifications: z.array(z.string()).default([]),
});
export type AppointmentExtraction = z.infer<typeof AppointmentExtraction>;

/**
 * "Zirconia crown for Ramesh, tooth 26, shade A2, Saveetha lab, one week, three thousand" →
 * lab-case draft (Phase 9.7 W1.2.4). Patient + vendor names fuzzy-match server-side.
 */
export const LabNewCaseExtraction = z.object({
  patientName: z.string().nullable().default(null),
  type: LabCaseType.nullable().default(null),
  teeth: z.array(z.number().int()).default([]),
  material: z.string().nullable().default(null),
  shade: z.string().nullable().default(null),
  description: z.string().nullable().default(null),
  vendorName: z.string().nullable().default(null),
  expectedTurnaroundDays: z.number().int().positive().nullable().default(null),
  costPaise: z.number().int().nonnegative().nullable().default(null),
  patientChargePaise: z.number().int().nonnegative().nullable().default(null),
  notes: z.string().nullable().default(null),
  clarifications: z.array(z.string()).default([]),
});
export type LabNewCaseExtraction = z.infer<typeof LabNewCaseExtraction>;

/** Server-side fuzzy match of a spoken item name against the clinic's catalog. */
export interface InventoryItemMatch {
  itemId: string;
  name: string;
  unitOfMeasure: string;
  currentStock: number;
  /** 0-1 similarity; 1 = exact normalized match. */
  score: number;
}
