import { createHash } from 'node:crypto';
import type { ISttProvider, SttResult, SttTranscribeOptions } from './sender.js';

/**
 * If the "audio" buffer decodes to UTF-8 text starting with this prefix, the mock returns the
 * remainder verbatim as the transcript. This gives tests + the demo full deterministic control
 * over what the pipeline "hears" (e.g. inject the exact RCT note), while genuinely-random audio
 * still falls back to a hash-selected canned transcript — so the mock varies by input (not a lie).
 */
export const MOCK_TRANSCRIPT_PREFIX = 'MOCK_TRANSCRIPT:';

/** Realistic Indian-dental voice notes so the mock extractor downstream has keywords to match. */
const CANNED_TRANSCRIPTS = [
  'RCT on 26 completed, third sitting. Amoxicillin 500mg TID for 5 days. Review next week.',
  'Scaling and polishing done for the whole mouth. Advised warm saline rinse twice daily.',
  'Extraction of 38, healing well. Paracetamol 500mg SOS for pain. Review after 3 days.',
  'Composite filling on 16, caries removed. No medication needed. Recall after 6 months.',
];

function hashIndex(audio: Buffer, modulo: number): number {
  const digest = createHash('sha256').update(audio).digest();
  return digest.readUInt32BE(0) % modulo;
}

/** ~400ms per spoken word, clamped to a sane 5s–120s range — a plausible simulated clip length. */
function estimateDurationMs(transcript: string): number {
  const words = transcript.trim().split(/\s+/).length;
  return Math.min(120_000, Math.max(5_000, words * 400));
}

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Deterministic, free, offline STT for tests + UI iteration. Latency defaults to 0 (fast tests);
 * the factory injects ~800ms in dev so the progress UI feels real (see docs/voice-pipeline.md).
 */
export class MockSttProvider implements ISttProvider {
  constructor(private readonly opts: { latencyMs?: number } = {}) {}

  async transcribe(audio: Buffer, opts: SttTranscribeOptions): Promise<SttResult> {
    const latencyMs = this.opts.latencyMs ?? 0;
    if (latencyMs > 0) await delay(latencyMs);

    const text = audio.toString('utf8');
    const transcript = text.startsWith(MOCK_TRANSCRIPT_PREFIX)
      ? text.slice(MOCK_TRANSCRIPT_PREFIX.length)
      : CANNED_TRANSCRIPTS[hashIndex(audio, CANNED_TRANSCRIPTS.length)]!;

    const languageCode = !opts.language || opts.language === 'auto' ? 'en-IN' : opts.language;

    return {
      providerId: 'mock',
      transcript,
      languageCode,
      durationMs: estimateDurationMs(transcript),
    };
  }
}
