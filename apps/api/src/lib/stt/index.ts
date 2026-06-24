import { MockSttProvider } from './mock-provider.js';
import { SarvamSttProvider, type SttLogger } from './sarvam-provider.js';
import type { ISttProvider } from './sender.js';

export type {
  ISttProvider,
  SttResult,
  SttSegment,
  SttLanguage,
  SttTranscribeOptions,
} from './sender.js';
export { MockSttProvider, MOCK_TRANSCRIPT_PREFIX } from './mock-provider.js';
export { SarvamSttProvider, type SttLogger } from './sarvam-provider.js';

/**
 * Returns the STT provider selected by STT_PROVIDER. Defaults to the deterministic mock so dev
 * and tests never hit (or pay for) the real Sarvam API. In dev the mock gets ~800ms of simulated
 * latency so the progress UI feels real; tests construct the mock directly with 0ms.
 */
export function getSttProvider(logger?: SttLogger): ISttProvider {
  if (process.env.STT_PROVIDER === 'sarvam') return new SarvamSttProvider(undefined, logger);
  const latencyMs = process.env.NODE_ENV === 'test' ? 0 : 800;
  return new MockSttProvider({ latencyMs });
}
