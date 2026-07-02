import { AppError } from '../../errors.js';
import { GeminiExtractor, type ExtractorLogger } from '../gemini-extractor.js';
import type { Extractor } from './types.js';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The one runner every Phase 9.7 dictate endpoint calls. Selects the provider (AI_PROVIDER, same
 * switch as getExtractor), runs the surface's prompt, and validates the output against the
 * extractor's Zod schema — a malformed provider response is a 502 EXTRACTION_FAILED, never a
 * half-parsed object reaching business logic. Retries/backoff live inside GeminiExtractor.
 */
export async function extractFromTranscript<T, C>(
  extractor: Extractor<T, C>,
  transcript: string,
  ctx: C,
  logger?: ExtractorLogger,
): Promise<T> {
  let raw: unknown;
  if (process.env.AI_PROVIDER === 'gemini') {
    raw = await new GeminiExtractor(undefined, logger).generateStructured(
      extractor.buildSystemInstruction(ctx),
      transcript,
      extractor.responseSchema,
    );
  } else {
    // Mock path mirrors getExtractor's dev latency so progress UI feels real; tests run at 0ms.
    if (process.env.NODE_ENV !== 'test') await delay(1200);
    raw = extractor.mockExtract(transcript, ctx);
  }

  const parsed = extractor.zodSchema.safeParse(raw);
  if (!parsed.success) {
    logger?.error(
      { extractor: extractor.id, promptVersion: extractor.promptVersion, issues: parsed.error.issues.slice(0, 5) },
      'Extraction returned an invalid shape',
    );
    throw new AppError(
      `Voice extraction failed (${extractor.id} returned an invalid shape)`,
      502,
      'EXTRACTION_FAILED',
      { extractor: extractor.id, issues: parsed.error.issues.slice(0, 5) },
    );
  }
  return parsed.data;
}
