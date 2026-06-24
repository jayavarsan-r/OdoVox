import { MockExtractor } from './mock-extractor.js';
import { GeminiExtractor, type ExtractorLogger } from './gemini-extractor.js';
import type { IClinicalExtractor } from './extractor.js';

export type { IClinicalExtractor } from './extractor.js';
export { MockExtractor } from './mock-extractor.js';
export { GeminiExtractor, type ExtractorLogger } from './gemini-extractor.js';

/**
 * Returns the extractor selected by AI_PROVIDER. Defaults to the deterministic keyword mock so dev
 * and tests never call (or pay for) Gemini. In dev the mock simulates ~1200ms so the "Understanding"
 * progress step feels real; tests construct the mock directly with 0ms.
 */
export function getExtractor(logger?: ExtractorLogger): IClinicalExtractor {
  if (process.env.AI_PROVIDER === 'gemini') return new GeminiExtractor(undefined, logger);
  const latencyMs = process.env.NODE_ENV === 'test' ? 0 : 1200;
  return new MockExtractor({ latencyMs });
}
