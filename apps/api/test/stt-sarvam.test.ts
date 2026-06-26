import { afterEach, describe, expect, it, vi } from 'vitest';
import { SarvamSttProvider } from '../src/lib/stt/sarvam-provider.js';
import { MockSttProvider } from '../src/lib/stt/mock-provider.js';
import { getSttProvider } from '../src/lib/stt/index.js';

afterEach(() => vi.restoreAllMocks());

const sarvamOk = (body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

describe('SarvamSttProvider', () => {
  it('posts multipart to the Sarvam endpoint with the key, model and auto-detect language', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        sarvamOk({ request_id: 'req_9', transcript: 'RCT on 26 completed.', language_code: 'en-IN' }),
      );

    const provider = new SarvamSttProvider({ apiKey: 'SK', model: 'saarika:v2.5', backoffBaseMs: 0 });
    const res = await provider.transcribe(Buffer.from('audio'), {
      mimeType: 'audio/webm',
      language: 'auto',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://api.sarvam.ai/speech-to-text');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    expect(headers['api-subscription-key']).toBe('SK');

    const form = init?.body as FormData;
    expect(form).toBeInstanceOf(FormData);
    expect(form.get('model')).toBe('saarika:v2.5');
    expect(form.get('language_code')).toBe('unknown'); // 'auto' → 'unknown' (Sarvam auto-detects)
    expect(form.get('with_timestamps')).toBe('true');
    expect(form.get('file')).toBeInstanceOf(Blob);

    expect(res.transcript).toBe('RCT on 26 completed.');
    expect(res.providerId).toBe('req_9');
    expect(res.languageCode).toBe('en-IN');
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('maps an explicit language to the Sarvam language_code', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(sarvamOk({ request_id: 'r', transcript: 't', language_code: 'ta-IN' }));

    const provider = new SarvamSttProvider({ apiKey: 'SK', backoffBaseMs: 0 });
    await provider.transcribe(Buffer.from('a'), { mimeType: 'audio/webm', language: 'ta-IN' });

    const form = fetchSpy.mock.calls[0]![1]?.body as FormData;
    expect(form.get('language_code')).toBe('ta-IN');
  });

  it('retries on a transient 5xx then succeeds', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('upstream busy', { status: 503 }))
      .mockResolvedValueOnce(sarvamOk({ request_id: 'r2', transcript: 'ok', language_code: 'en-IN' }));

    const provider = new SarvamSttProvider({ apiKey: 'SK', backoffBaseMs: 0 });
    const res = await provider.transcribe(Buffer.from('a'), { mimeType: 'audio/webm' });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(res.transcript).toBe('ok');
  });

  it('does not retry a 4xx and throws', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('bad request', { status: 400 }));

    const provider = new SarvamSttProvider({ apiKey: 'SK', backoffBaseMs: 0 });
    await expect(provider.transcribe(Buffer.from('a'), { mimeType: 'audio/webm' })).rejects.toThrow(
      /Sarvam/,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('gives up after exhausting retries on persistent 5xx', async () => {
    // Fresh Response per call — the provider reads res.text(), so a reused Response would be
    // "Body already read" on retry.
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(() => Promise.resolve(new Response('down', { status: 500 })));

    const provider = new SarvamSttProvider({ apiKey: 'SK', maxRetries: 2, backoffBaseMs: 0 });
    await expect(provider.transcribe(Buffer.from('a'), { mimeType: 'audio/webm' })).rejects.toThrow(
      /Sarvam/,
    );
    expect(fetchSpy).toHaveBeenCalledTimes(3); // initial + 2 retries
  });

  it('throws when not configured (no API key)', () => {
    expect(() => new SarvamSttProvider({ apiKey: '' })).toThrow(/not configured/);
  });
});

describe('getSttProvider factory', () => {
  const prev = { ...process.env };
  afterEach(() => {
    process.env.STT_PROVIDER = prev.STT_PROVIDER;
    process.env.SARVAM_API_KEY = prev.SARVAM_API_KEY;
  });

  it('returns the mock provider by default', () => {
    process.env.STT_PROVIDER = 'mock';
    expect(getSttProvider()).toBeInstanceOf(MockSttProvider);
  });

  it('returns the Sarvam provider when STT_PROVIDER=sarvam', () => {
    process.env.STT_PROVIDER = 'sarvam';
    process.env.SARVAM_API_KEY = 'SK';
    expect(getSttProvider()).toBeInstanceOf(SarvamSttProvider);
  });
});
