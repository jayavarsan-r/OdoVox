import type { ClinicalExtraction } from '@odovox/types';

/**
 * Verification-card safety model. Warnings are NEVER silently dropped: once the doctor edits a
 * field that resolves a warning, it re-renders as `resolved` (with a check), not removed. Blocking
 * errors (invalid tooth) gate Confirm until resolved. Resolution is detected by checking whether the
 * warning's target entity still exists in the current (edited) structured data.
 */

export interface SafetyWarning {
  code: string;
  message: string;
  field?: string;
  detail?: string;
}

export interface SafetyViewItem extends SafetyWarning {
  resolved: boolean;
  blocking: boolean;
}

export interface SafetyPayload {
  warnings: SafetyWarning[];
  blockingErrors: SafetyWarning[];
}

function hasMedicine(data: ClinicalExtraction, name?: string): boolean {
  if (!name) return false;
  const n = name.trim().toLowerCase();
  return data.prescriptions.some((p) => p.name.trim().toLowerCase() === n);
}

function hasTooth(data: ClinicalExtraction, tooth?: string): boolean {
  if (tooth === undefined) return false;
  const t = Number(tooth);
  return data.teeth.includes(t) || data.toothStatusUpdates.some((u) => u.tooth === t);
}

/** A warning is resolved when its offending entity is gone / corrected in the edited data. */
function isResolved(w: SafetyWarning, data: ClinicalExtraction): boolean {
  switch (w.code) {
    case 'allergy_conflict':
    case 'drug_interaction':
    case 'antibiotic_duration':
    case 'pediatric_dosage':
    case 'pregnancy_risk':
      // Resolved if the flagged medicine is no longer prescribed.
      return !hasMedicine(data, w.detail);
    case 'invalid_tooth':
      return !hasTooth(data, w.detail);
    case 'sitting_overflow':
      return !(
        data.sittingCurrent != null &&
        data.sittingTotal != null &&
        data.sittingCurrent > data.sittingTotal
      );
    case 'sitting_jump':
      // Can't recheck the plan client-side; treat any sitting edit as the doctor's acknowledgement.
      return false;
    default:
      return false;
  }
}

export function buildSafetyView(safety: SafetyPayload, data: ClinicalExtraction): SafetyViewItem[] {
  const warnings = safety.warnings.map((w) => ({ ...w, blocking: false, resolved: isResolved(w, data) }));
  const blocking = safety.blockingErrors.map((w) => ({ ...w, blocking: true, resolved: isResolved(w, data) }));
  return [...blocking, ...warnings];
}

/** Confirm stays disabled while any BLOCKING error is unresolved. */
export function hasUnresolvedBlocking(items: SafetyViewItem[]): boolean {
  return items.some((i) => i.blocking && !i.resolved);
}

/** Codes of the warnings still active — snapshotted into the audit on CONFIRMED_WITH_WARNING. */
export function activeWarningCodes(items: SafetyViewItem[]): string[] {
  return items.filter((i) => !i.resolved).map((i) => (i.detail ? `${i.code}:${i.detail}` : i.code));
}
