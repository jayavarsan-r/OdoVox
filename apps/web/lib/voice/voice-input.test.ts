import { describe, expect, it } from 'vitest';
import { ApiError } from '../api-client';
import {
  MAX_DICTATION_MS,
  appendTranscript,
  resolveEndpoint,
  voiceErrorMessage,
  voiceStatusCopy,
} from './voice-input';

describe('VoiceInput pure logic', () => {
  it('resolves endpoints per mode — extraction requires one, others default to transcribe', () => {
    expect(resolveEndpoint('single-shot')).toBe('/dictate/transcribe');
    expect(resolveEndpoint('notes')).toBe('/dictate/transcribe');
    expect(resolveEndpoint('extraction', '/inventory/dictate/purchase')).toBe('/inventory/dictate/purchase');
    expect(() => resolveEndpoint('extraction')).toThrow(/requires an endpoint/);
  });

  it('uses the Phase 9.5 friendly copy while recording and processing', () => {
    expect(voiceStatusCopy('recording')).toBe('Listening…');
    expect(voiceStatusCopy('processing')).toBe('Making sense of it…');
    expect(voiceStatusCopy('idle')).toBeNull();
    expect(voiceStatusCopy('done')).toBeNull();
  });

  it('maps errors: provider failure → typing fallback, network failure → retry', () => {
    expect(voiceErrorMessage(new ApiError(502, 'EXTRACTION_FAILED', 'Gemini extraction failed'))).toBe(
      'Voice unavailable — try typing instead.',
    );
    expect(voiceErrorMessage(new ApiError(500, 'INTERNAL', 'boom'))).toBe('Voice unavailable — try typing instead.');
    expect(voiceErrorMessage(new ApiError(422, 'VALIDATION_ERROR', 'Audio file too large'))).toBe(
      'Audio file too large',
    );
    expect(voiceErrorMessage(new TypeError('Failed to fetch'))).toBe('Could not reach the server — try again.');
  });

  it('appends dictated notes with a single separator and trims noise', () => {
    expect(appendTranscript('', 'Pay in two weeks. ')).toBe('Pay in two weeks.');
    expect(appendTranscript('Balance due.', 'Pay in two weeks.')).toBe('Balance due. Pay in two weeks.');
    expect(appendTranscript('Balance due.', '   ')).toBe('Balance due.');
    expect(MAX_DICTATION_MS).toBe(60_000);
  });
});
