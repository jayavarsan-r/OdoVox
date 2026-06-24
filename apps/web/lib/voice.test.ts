import { describe, expect, it } from 'vitest';
import { isVoiceSupported, createRecognizer } from './voice';

describe('voice stub (SSR-safe)', () => {
  it('reports unsupported and returns null when there is no window (SSR / no Web Speech)', () => {
    // In the node test env there is no window/SpeechRecognition.
    expect(isVoiceSupported()).toBe(false);
    expect(createRecognizer({ onTranscript: () => {} })).toBeNull();
  });
});
