import { FdiToothNumber, type ClinicalExtraction } from '@odovox/types';
import {
  ANTIBIOTICS,
  DRUG_INTERACTIONS,
  MEDICINE_ALLERGY_CLASSES,
  PREGNANCY_RISK,
} from './drug-interactions.js';

/**
 * Safety layer — runs AFTER extraction, BEFORE the verification card renders. Pure + deterministic.
 *
 * THE RULE: warnings FLAG, they never block. The doctor sees them and decides. Only `blockingErrors`
 * (e.g. tooth 19 — doesn't exist) stop the flow until the doctor fixes the field.
 */

/** Minimal patient shape the checks need — decoupled from the Prisma Patient model. */
export interface SafetyPatient {
  age: number | null;
  medicalFlags: string[];
}

export interface SafetyWarning {
  code: string;
  message: string;
  field?: string;
  detail?: string;
}

export type SafetyBlockingError = SafetyWarning;

export interface SafetyResult {
  warnings: SafetyWarning[];
  blockingErrors: SafetyBlockingError[];
}

export interface SafetyOptions {
  /** The plan's expected next sitting, if there's an active plan — enables the sitting-jump check. */
  expectedNextSitting?: number;
}

const norm = (s: string): string => s.trim().toLowerCase();

const PEDIATRIC_AGE = 12;
const ADULT_DOSE_MG = 250;
const MAX_ANTIBIOTIC_DAYS = 14;

function dosageMg(dosage: string | null): number | null {
  const m = dosage?.match(/(\d+(?:\.\d+)?)\s*mg/i);
  return m ? Number(m[1]) : null;
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function runSafetyChecks(
  extracted: ClinicalExtraction,
  patient: SafetyPatient,
  allergies: string[],
  opts: SafetyOptions = {},
): SafetyResult {
  const warnings: SafetyWarning[] = [];
  const blockingErrors: SafetyBlockingError[] = [];

  const meds = extracted.prescriptions.map((p) => ({ raw: p, name: norm(p.name) }));
  const flagsText = patient.medicalFlags.map(norm).join(' | ');
  const allergyTokens = allergies.map(norm).filter(Boolean);

  // An "agent" is present if it matches a prescribed medicine name or appears in the medical flags.
  const agentPresent = (agent: string): boolean => {
    const a = norm(agent);
    if (meds.some((m) => m.name.includes(a) || a.includes(m.name))) return true;
    return flagsText.includes(a);
  };

  // 1. Allergy cross-check.
  for (const med of meds) {
    const classes = MEDICINE_ALLERGY_CLASSES[med.name] ?? [med.name];
    const matched = allergyTokens.find((a) => classes.some((c) => c.includes(a) || a.includes(c)));
    if (matched) {
      const original = allergies.find((x) => norm(x) === matched) ?? matched;
      const cls = classes.find((c) => c.includes(matched) || matched.includes(c)) ?? matched;
      warnings.push({
        code: 'allergy_conflict',
        field: 'prescriptions',
        detail: med.raw.name,
        message: `Allergy conflict: patient lists ${original}. ${med.raw.name} is a ${cls}. Verify before prescribing.`,
      });
    }
  }

  // 2. Drug–drug / drug–condition interactions.
  for (const ix of DRUG_INTERACTIONS) {
    if (agentPresent(ix.a) && agentPresent(ix.b)) {
      warnings.push({
        code: 'drug_interaction',
        field: 'prescriptions',
        detail: `${ix.a}+${ix.b}`,
        message: `Possible interaction: ${cap(ix.a)} + ${cap(ix.b)}. ${ix.note}`,
      });
    }
  }

  // 3. Tooth-number validity (FDI 11-48) — BLOCKING.
  const teeth = new Set<number>([
    ...extracted.teeth,
    ...extracted.toothStatusUpdates.map((t) => t.tooth),
  ]);
  for (const tooth of teeth) {
    if (!FdiToothNumber.safeParse(tooth).success) {
      blockingErrors.push({
        code: 'invalid_tooth',
        field: 'teeth',
        detail: String(tooth),
        message: `Tooth ${tooth} is not a valid FDI number (11–48). Correct it before confirming.`,
      });
    }
  }

  // 4. Sitting overflow.
  const { sittingCurrent, sittingTotal } = extracted;
  if (sittingCurrent != null && sittingTotal != null && sittingCurrent > sittingTotal) {
    warnings.push({
      code: 'sitting_overflow',
      field: 'sittings',
      message: `Sitting ${sittingCurrent} of ${sittingTotal} — current exceeds the total. Check the sitting count.`,
    });
  }

  // 5. Sitting jump (needs plan context).
  if (
    opts.expectedNextSitting != null &&
    sittingCurrent != null &&
    sittingCurrent > opts.expectedNextSitting
  ) {
    warnings.push({
      code: 'sitting_jump',
      field: 'sittings',
      message: `Plan is at sitting ${opts.expectedNextSitting}, but this records sitting ${sittingCurrent}. Confirm the jump.`,
    });
  }

  // 7. Antibiotic course longer than 14 days.
  for (const med of meds) {
    if (ANTIBIOTICS.has(med.name) && med.raw.durationDays != null && med.raw.durationDays > MAX_ANTIBIOTIC_DAYS) {
      warnings.push({
        code: 'antibiotic_duration',
        field: 'prescriptions',
        detail: med.raw.name,
        message: `${med.raw.name} for ${med.raw.durationDays} days is unusually long for an antibiotic. Verify.`,
      });
    }
  }

  // 8. Pediatric: adult-range dose for a child.
  if (patient.age != null && patient.age < PEDIATRIC_AGE) {
    for (const med of meds) {
      const mg = dosageMg(med.raw.dosage);
      if (mg != null && mg >= ADULT_DOSE_MG) {
        warnings.push({
          code: 'pediatric_dosage',
          field: 'prescriptions',
          detail: med.raw.name,
          message: `Patient is ${patient.age} — ${med.raw.name} ${med.raw.dosage} looks like an adult dose. Check paediatric dosing.`,
        });
      }
    }
  }

  // 9. Pregnancy risk.
  const pregnant = patient.medicalFlags.some((f) => /pregnan/i.test(f));
  if (pregnant) {
    for (const med of meds) {
      if (PREGNANCY_RISK.has(med.name)) {
        warnings.push({
          code: 'pregnancy_risk',
          field: 'prescriptions',
          detail: med.raw.name,
          message: `${med.raw.name} is best avoided in pregnancy. Verify before prescribing.`,
        });
      }
    }
  }

  return { warnings, blockingErrors };
}

/** Serialize warnings to the compact `code:detail` strings stored in Consultation.safetyWarnings. */
export function serializeSafetyWarnings(result: SafetyResult): string[] {
  return result.warnings.map((w) => (w.detail ? `${w.code}:${w.detail}` : w.code));
}
