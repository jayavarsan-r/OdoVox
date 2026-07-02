import type { ZodType, ZodTypeDef } from 'zod';
import type { GeminiSchema } from '../response-schema.js';

/**
 * Phase 9.7 W1.4 — one extractor definition per voice surface (inventory purchase/consume/adjust,
 * lab new-case, appointment, bill items, lab reply…). Each file under this directory exports one
 * `Extractor` and every dictate endpoint runs it through `extractFromTranscript` so error handling,
 * provider selection, and validation stay identical everywhere.
 *
 * The Zod schema is the source of truth; the Gemini responseSchema mirrors it (same convention as
 * response-schema.ts ↔ @odovox/types).
 */
export interface Extractor<T, C> {
  /** Stable id for logs/audits, e.g. 'inventory-purchase'. */
  id: string;
  /** Bump on any wording change (docs/voice-pipeline.md prompt-versioning rule). */
  promptVersion: string;
  buildSystemInstruction(ctx: C): string;
  responseSchema: GeminiSchema;
  /** Input side is `unknown` — schemas with `.default()` diverge between input and output. */
  zodSchema: ZodType<T, ZodTypeDef, unknown>;
  /** Deterministic keyword mock — same contract as real Gemini (AI_PROVIDER != 'gemini'). */
  mockExtract(transcript: string, ctx: C): T;
}
