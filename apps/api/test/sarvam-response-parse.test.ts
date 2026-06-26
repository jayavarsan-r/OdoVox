import { describe, expect, it, vi, afterEach } from 'vitest';
import { SarvamSttProvider } from '../src/lib/stt/sarvam-provider.js';

afterEach(() => vi.restoreAllMocks());

// Captured from a live Sarvam saarika:v2.5 response during diagnosis.
const REAL_SARVAM_RESPONSE = {
  request_id: '20260626_64eeae18-4f81-40c7-a507-1ccb9507843f',
  transcript: 'Root canal treatment on 26th, third sitting. Prescribe amoxicillin 500 milligrams.',
  timestamps: { words: ['Root canal…'], start_time_seconds: [0.0], end_time_seconds: [6.23] },
  language_code: 'en-IN',
};

describe('Sarvam response parsing', () => {
  it('extracts transcript, language_code and request_id from the real response shape', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(REAL_SARVAM_RESPONSE), { status: 200 }));
    const result = await new SarvamSttProvider({ apiKey: 'SK_test_1234567890' }).transcribe(Buffer.from('a'), {
      mimeType: 'audio/webm',
      language: 'auto',
    });
    expect(result.transcript).toContain('Root canal treatment on 26th');
    expect(result.languageCode).toBe('en-IN');
    expect(result.providerId).toBe(REAL_SARVAM_RESPONSE.request_id);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('handles an "unknown" language_code (auto-detect undecided) by passing it through', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ transcript: 'hi', language_code: 'unknown' }), { status: 200 }),
    );
    const result = await new SarvamSttProvider({ apiKey: 'SK_test_1234567890' }).transcribe(Buffer.from('a'), {
      mimeType: 'audio/webm',
      language: 'auto',
    });
    expect(result.languageCode).toBe('unknown');
  });

  it('tolerates a 200 with an empty transcript', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ transcript: '' }), { status: 200 }));
    const result = await new SarvamSttProvider({ apiKey: 'SK_test_1234567890' }).transcribe(Buffer.from('a'), {
      mimeType: 'audio/webm',
      language: 'auto',
    });
    expect(result.transcript).toBe('');
  });
});
