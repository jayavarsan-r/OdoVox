import { describe, expect, it } from 'vitest';
import {
  MockSttProvider,
  MOCK_TRANSCRIPT_PREFIX,
} from '../src/lib/stt/mock-provider.js';

describe('MockSttProvider', () => {
  it('is deterministic — the same audio yields the same transcript', async () => {
    const provider = new MockSttProvider({ latencyMs: 0 });
    const audio = Buffer.from('fake-opus-audio-bytes-#1');

    const a = await provider.transcribe(audio, { mimeType: 'audio/webm', language: 'auto' });
    const b = await provider.transcribe(audio, { mimeType: 'audio/webm', language: 'auto' });

    expect(a.transcript).toBe(b.transcript);
    expect(a.transcript.length).toBeGreaterThan(0);
    expect(a.providerId).toBe('mock');
    expect(a.languageCode).toBe('en-IN'); // 'auto' resolves to en-IN in the mock
    expect(a.durationMs).toBeGreaterThan(0);
  });

  it('honors an injected transcript via the MOCK_TRANSCRIPT prefix (full test control)', async () => {
    const provider = new MockSttProvider({ latencyMs: 0 });
    const audio = Buffer.from(`${MOCK_TRANSCRIPT_PREFIX}Scaling done on 11 and 21.`);

    const res = await provider.transcribe(audio, { mimeType: 'audio/webm', language: 'hi-IN' });

    expect(res.transcript).toBe('Scaling done on 11 and 21.');
    expect(res.languageCode).toBe('hi-IN'); // an explicit language is preserved
  });
});
