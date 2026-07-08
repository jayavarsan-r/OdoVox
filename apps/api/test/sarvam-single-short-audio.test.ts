import { afterEach, describe, expect, it, vi } from 'vitest';
import { SarvamSttProvider } from '../src/lib/stt/sarvam-provider.js';
import type { SttAudioTools } from '../src/lib/stt/audio-chunker.js';

afterEach(() => vi.restoreAllMocks());

/**
 * Phase 9.6 Issue 7 (control case): short audio must keep the exact single-request path — one
 * multipart POST, no probing side effects on the payload, whether or not audio tools are wired.
 */

const sarvamOk = (): Response =>
  new Response(
    JSON.stringify({ request_id: 'req_1', transcript: 'scaling done on 26', language_code: 'en-IN' }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

describe('SarvamSttProvider — short audio stays single-shot', () => {
  it('audio under the 28s threshold makes exactly one Sarvam call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sarvamOk());
    const slice = vi.fn();
    const tools: SttAudioTools = {
      getDurationMs: async () => 20_000,
      sliceAudio: slice as unknown as SttAudioTools['sliceAudio'],
    };

    const provider = new SarvamSttProvider({ apiKey: 'SK', backoffBaseMs: 0, audioTools: tools });
    const res = await provider.transcribe(Buffer.from('short'), { mimeType: 'audio/webm', language: 'auto' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(slice).not.toHaveBeenCalled();
    expect(res.transcript).toBe('scaling done on 26');
  });

  it('without audio tools (short-dictation surfaces) behavior is unchanged', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(sarvamOk());
    const provider = new SarvamSttProvider({ apiKey: 'SK', backoffBaseMs: 0 });
    const res = await provider.transcribe(Buffer.from('short'), { mimeType: 'audio/webm', language: 'auto' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(res.languageCode).toBe('en-IN');
  });
});
