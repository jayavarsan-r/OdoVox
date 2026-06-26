import { describe, expect, it } from 'vitest';
import { GeminiExtractor } from '../src/lib/ai/gemini-extractor.js';
import { CLINICAL_RESPONSE_SCHEMA } from '../src/lib/ai/response-schema.js';

describe('Gemini request payload', () => {
  it('puts the prompt in systemInstruction and the transcript in contents (not vice-versa)', () => {
    const ex = new GeminiExtractor({ apiKey: 'GK_test_1234567890', model: 'gemini-2.5-flash' });
    const body = ex.buildPayload('SYSTEM PROMPT', 'the transcript text', CLINICAL_RESPONSE_SCHEMA) as {
      systemInstruction: { parts: { text: string }[] };
      contents: { role: string; parts: { text: string }[] }[];
      generationConfig: Record<string, unknown>;
    };
    expect(body.systemInstruction.parts[0]!.text).toBe('SYSTEM PROMPT');
    expect(body.contents[0]!.role).toBe('user');
    expect(body.contents[0]!.parts[0]!.text).toBe('the transcript text');
  });

  it('sets responseMimeType=application/json + responseSchema in generationConfig', () => {
    const ex = new GeminiExtractor({ apiKey: 'GK_test_1234567890', model: 'gemini-2.5-flash' });
    const cfg = (ex.buildPayload('s', 't', CLINICAL_RESPONSE_SCHEMA) as { generationConfig: Record<string, unknown> })
      .generationConfig;
    expect(cfg.responseMimeType).toBe('application/json');
    expect(cfg.responseSchema).toBe(CLINICAL_RESPONSE_SCHEMA);
    expect(cfg.temperature).toBe(0);
  });

  it('disables thinking for 2.5 models (so the JSON never truncates) and not for 2.0', () => {
    const cfg25 = (
      new GeminiExtractor({ apiKey: 'GK_test_1234567890', model: 'gemini-2.5-flash' }).buildPayload('s', 't', CLINICAL_RESPONSE_SCHEMA) as {
        generationConfig: { thinkingConfig?: { thinkingBudget: number } };
      }
    ).generationConfig;
    expect(cfg25.thinkingConfig).toEqual({ thinkingBudget: 0 });

    const cfg20 = (
      new GeminiExtractor({ apiKey: 'GK_test_1234567890', model: 'gemini-2.0-flash' }).buildPayload('s', 't', CLINICAL_RESPONSE_SCHEMA) as {
        generationConfig: { thinkingConfig?: unknown };
      }
    ).generationConfig;
    expect(cfg20.thinkingConfig).toBeUndefined();
  });

  it('truncates the transcript to the input-token budget', () => {
    const ex = new GeminiExtractor({ apiKey: 'GK_test_1234567890', model: 'gemini-2.5-flash' });
    const body = ex.buildPayload('s', 'a'.repeat(10_000), CLINICAL_RESPONSE_SCHEMA) as {
      contents: { parts: { text: string }[] }[];
    };
    expect(body.contents[0]!.parts[0]!.text.length).toBeLessThanOrEqual(4000);
  });
});
