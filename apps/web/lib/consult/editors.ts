import type { ClinicalExtraction, ExtractedPrescription, ExtractionProcedureStatus } from '@odovox/types';

/**
 * Pure per-field editors for the verification card. Each returns a NEW ClinicalExtraction (never
 * mutates) so the store can diff + PATCH. `toPatchBody` is the request body for PATCH
 * /consultations/:id. Editors are deliberately tiny + total so they're trivially testable.
 */

export function setProcedure(data: ClinicalExtraction, procedure: string | null): ClinicalExtraction {
  return { ...data, procedure };
}

export function setTeeth(data: ClinicalExtraction, teeth: number[]): ClinicalExtraction {
  return { ...data, teeth: [...teeth] };
}

export function setSittings(
  data: ClinicalExtraction,
  sittingCurrent: number | null,
  sittingTotal: number | null,
): ClinicalExtraction {
  return { ...data, sittingCurrent, sittingTotal };
}

export function setStatus(
  data: ClinicalExtraction,
  status: ExtractionProcedureStatus | null,
): ClinicalExtraction {
  return { ...data, status };
}

export function setFollowUp(
  data: ClinicalExtraction,
  afterDays: number | null,
  procedureHint: string | null,
): ClinicalExtraction {
  return { ...data, followUp: afterDays == null ? null : { afterDays, procedureHint } };
}

export function addMedicine(data: ClinicalExtraction, med: ExtractedPrescription): ClinicalExtraction {
  return { ...data, prescriptions: [...data.prescriptions, med] };
}

export function updateMedicine(
  data: ClinicalExtraction,
  index: number,
  med: ExtractedPrescription,
): ClinicalExtraction {
  return { ...data, prescriptions: data.prescriptions.map((p, i) => (i === index ? med : p)) };
}

export function removeMedicine(data: ClinicalExtraction, index: number): ClinicalExtraction {
  return { ...data, prescriptions: data.prescriptions.filter((_, i) => i !== index) };
}

export function setNotes(data: ClinicalExtraction, notes: string | null): ClinicalExtraction {
  return { ...data, notes };
}

export function setCost(data: ClinicalExtraction, estimatedCostPaise: number | null): ClinicalExtraction {
  return { ...data, estimatedCostPaise };
}

export function toPatchBody(data: ClinicalExtraction): { structuredData: ClinicalExtraction } {
  return { structuredData: data };
}
