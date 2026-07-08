import { afterEach, describe, expect, it, vi } from 'vitest';
import { SarvamSttProvider } from '../src/lib/stt/sarvam-provider.js';
import { chunkPlan, mergeTranscripts, type SttAudioTools } from '../src/lib/stt/audio-chunker.js';

afterEach(() => vi.restoreAllMocks());

/**
 * Phase 9.6 Issue 7: Sarvam batch caps a submission at ~30s, but rich clinical dictations run
 * minutes. Long audio must be probed, split into overlapping ≤25s chunks, transcribed chunk by
 * chunk, and the transcripts merged in order.
 */

const sarvamOk = (transcript: string): Response =>
  new Response(JSON.stringify({ request_id: `req_${transcript}`, transcript, language_code: 'ta-IN' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

/** Fake tools: fixed duration; slices are labeled buffers so we can assert order. */
function fakeTools(durationMs: number): SttAudioTools {
  return {
    getDurationMs: async () => durationMs,
    sliceAudio: async (_audio, _mime, chunk) => ({
      audio: Buffer.from(`slice@${chunk.startMs}`),
      mimeType: 'audio/wav',
    }),
  };
}

describe('chunkPlan', () => {
  it('splits 70s into overlapping ≤25s chunks covering the whole duration', () => {
    const plan = chunkPlan(70_000, 25_000, 3_000);
    expect(plan.map((c) => c.startMs)).toEqual([0, 22_000, 44_000, 66_000]);
    expect(plan[0]!.durationMs).toBe(25_000);
    expect(plan.at(-1)!.startMs + plan.at(-1)!.durationMs).toBe(70_000);
  });

  it('a duration exactly at one chunk yields a single chunk', () => {
    expect(chunkPlan(25_000, 25_000, 3_000)).toEqual([{ startMs: 0, durationMs: 25_000 }]);
  });
});

describe('mergeTranscripts', () => {
  it('joins in order and drops silent chunks', () => {
    expect(mergeTranscripts(['patient ku 3 6 la', '', ' rct panniaachu '])).toBe('patient ku 3 6 la rct panniaachu');
  });
});

describe('SarvamSttProvider — long audio', () => {
  it('probes duration, transcribes each chunk, and merges the transcripts', async () => {
    let call = 0;
    const parts = ['patient ku deep root pain 3 6 la', 'rct 1st sitting panniaachu', 'paracetamol 650 bd 5 days', 'fees 5000 collect'];
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async () => sarvamOk(parts[call++] ?? ''));

    const provider = new SarvamSttProvider({
      apiKey: 'SK',
      backoffBaseMs: 0,
      audioTools: fakeTools(70_000),
    });
    const res = await provider.transcribe(Buffer.from('long-audio'), { mimeType: 'audio/webm', language: 'auto' });

    expect(fetchSpy).toHaveBeenCalledTimes(4); // 70s → 4 chunks
    expect(res.transcript).toBe(parts.join(' '));
    expect(res.languageCode).toBe('ta-IN');
  });

  it('a failed duration probe degrades to the single-shot path (never blocks the doctor)', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sarvamOk('short note'));
    const provider = new SarvamSttProvider({
      apiKey: 'SK',
      backoffBaseMs: 0,
      audioTools: {
        getDurationMs: async () => {
          throw new Error('ffprobe missing');
        },
        sliceAudio: async () => {
          throw new Error('unreachable');
        },
      },
    });
    const res = await provider.transcribe(Buffer.from('audio'), { mimeType: 'audio/webm', language: 'auto' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.transcript).toBe('short note');
  });
});
