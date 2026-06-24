import type { SafetyPayload } from './safety-view.js';

/** Server shapes for the consultation surface (mirrors the API's GET /consultations/:id response). */

export type ConsultationStatusValue = 'PENDING_REVIEW' | 'CONFIRMED' | 'REJECTED';

export interface ConsultationView {
  id: string;
  visitId: string;
  status: ConsultationStatusValue;
  /** ClinicalExtraction shape + an optional `safety` key ({ warnings, blockingErrors }). */
  structuredData: Record<string, unknown>;
  safetyWarnings: string[];
  languageCode: string | null;
  audioDurationMs: number | null;
  provider: string | null;
  transcript?: string;
  latestJob: { kind: string; status: string; lastError?: string | null } | null;
}

export type ConsultEventType =
  | 'RECORDED'
  | 'TRANSCRIBING'
  | 'TRANSCRIBED'
  | 'EXTRACTING'
  | 'READY'
  | 'FAILED';

export interface ConsultEvent {
  type: ConsultEventType;
  data?: {
    transcript?: string;
    structuredData?: Record<string, unknown>;
    stage?: string;
    message?: string;
  };
}

/** Pull the rich safety object the extraction worker embeds under structuredData.safety. */
export function extractSafetyPayload(structuredData: Record<string, unknown>): SafetyPayload {
  const safety = structuredData.safety as SafetyPayload | undefined;
  return { warnings: safety?.warnings ?? [], blockingErrors: safety?.blockingErrors ?? [] };
}
