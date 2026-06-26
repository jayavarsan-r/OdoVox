import { describe, expect, it, vi, afterEach } from 'vitest';
import { SarvamSttProvider } from '../src/lib/stt/sarvam-provider.js';

afterEach(() => vi.restoreAllMocks());

describe('Sarvam error paths', () => {
  it('throws immediately (no retry) on a 401 and surfaces the status', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{"error":"unauthorized"}', { status: 401 }));
    const provider = new SarvamSttProvider({ apiKey: 'SK_test_1234567890', maxRetries: 2, backoffBaseMs: 0 });
    await expect(provider.transcribe(Buffer.from('a'), { mimeType: 'audio/webm', language: 'auto' })).rejects.toThrow(
      /Sarvam STT failed \(HTTP 401\)/,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1); // 4xx is our fault — don't waste retries
  });

  it('retries a transient 5xx then succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('busy', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ transcript: 'recovered', language_code: 'en-IN' }), { status: 200 }));
    const provider = new SarvamSttProvider({ apiKey: 'SK_test_1234567890', maxRetries: 2, backoffBaseMs: 0 });
    const result = await provider.transcribe(Buffer.from('a'), { mimeType: 'audio/webm', language: 'auto' });
    expect(result.transcript).toBe('recovered');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('attaches the response body to the error details for diagnosis', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":{"message":"Invalid file type: audio/webm;codecs=opus"}}', { status: 400 }),
    );
    const provider = new SarvamSttProvider({ apiKey: 'SK_test_1234567890', maxRetries: 0 });
    await expect(
      provider.transcribe(Buffer.from('a'), { mimeType: 'audio/webm', language: 'auto' }),
    ).rejects.toMatchObject({ code: 'STT_FAILED', details: expect.objectContaining({ status: 400 }) });
  });
});
