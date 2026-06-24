import type {
  ClinicalExtraction,
  ClinicalExtractionContext,
  PatientIntakeExtraction,
  PrescriptionContext,
  PrescriptionExtraction,
} from '@odovox/types';

/**
 * Provider-agnostic clinical extraction. The pipeline depends only on `IClinicalExtractor`, so the
 * deterministic mock and real Gemini are swapped behind `getExtractor()` via `AI_PROVIDER`. The
 * business logic above this interface is identical for both. See docs/voice-pipeline.md.
 */
export interface IClinicalExtractor {
  extractClinical(
    transcript: string,
    ctx: ClinicalExtractionContext,
  ): Promise<ClinicalExtraction>;
  extractPrescription(
    transcript: string,
    ctx: PrescriptionContext,
  ): Promise<PrescriptionExtraction>;
  extractPatientIntake(transcript: string): Promise<PatientIntakeExtraction>;
}
