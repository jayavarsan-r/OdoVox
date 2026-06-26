import { describe, expect, it, vi, afterEach } from 'vitest';
import { SarvamSttProvider } from '../src/lib/stt/sarvam-provider.js';

afterEach(() => vi.restoreAllMocks());

describe('Sarvam multipart request shape', () => {
  const provider = new SarvamSttProvider({ apiKey: 'SK_test_key_1234567890', model: 'saarika:v2.5' });

  it('builds a FormData with file (named, codecs-stripped), model, language_code, with_timestamps', async () => {
    const form = provider.buildForm(Buffer.from('audio-bytes'), { mimeType: 'audio/webm;codecs=opus', language: 'auto' });
    const file = form.get('file') as File;
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe('audio.webm'); // explicit filename with extension
    expect(file.type).toBe('audio/webm'); // ;codecs=opus stripped — Sarvam rejects it (HTTP 400)
    expect(form.get('model')).toBe('saarika:v2.5');
    expect(form.get('language_code')).toBe('unknown'); // 'auto' → Sarvam's auto-detect token
    expect(form.get('with_timestamps')).toBe('true');
  });

  it('passes an explicit language code through unchanged', () => {
    const form = provider.buildForm(Buffer.from('x'), { mimeType: 'audio/wav', language: 'hi-IN' });
    expect(form.get('language_code')).toBe('hi-IN');
    expect((form.get('file') as File).name).toBe('audio.wav');
  });

  it('sends the api key header and never a manual Content-Type (boundary must come from FormData)', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ transcript: 't', language_code: 'en-IN' }), { status: 200 }));
    await provider.transcribe(Buffer.from('a'), { mimeType: 'audio/webm', language: 'auto' });
    const init = fetchSpy.mock.calls[0]![1]!;
    const headers = init.headers as Record<string, string>;
    expect(headers['api-subscription-key']).toBe('SK_test_key_1234567890');
    expect(Object.keys(headers).map((h) => h.toLowerCase())).not.toContain('content-type');
    expect(init.body).toBeInstanceOf(FormData);
  });
});
