import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClinicalExtractionContext } from '@odovox/types';
import { GeminiExtractor } from '../src/lib/ai/gemini-extractor.js';
import { MockExtractor } from '../src/lib/ai/mock-extractor.js';
import { getExtractor } from '../src/lib/ai/index.js';

afterEach(() => vi.restoreAllMocks());

const ctx: ClinicalExtractionContext = {
  name: 'Akhilesh Guhan',
  age: 34,
  gender: 'MALE',
  allergies: ['Penicillin'],
  medicalFlags: [],
  currentPlanSummary: null,
  lastVisitSummary: null,
  chiefComplaint: null,
};

const geminiOk = (text: string): Response =>
  new Response(
    JSON.stringify({
      candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }],
      usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 120 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );

const VALID_CLINICAL = JSON.stringify({
  procedure: 'RCT',
  teeth: [26],
  prescriptions: [],
  toothStatusUpdates: [],
  clarifications: [],
  safetyWarnings: [],
});

describe('GeminiExtractor.extractClinical', () => {
  it('builds the generateContent request with schema + patient context, then parses the result', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiOk(VALID_CLINICAL));

    const r = await new GeminiExtractor({ apiKey: 'GK', model: 'gemini-2.0-flash' }).extractClinical(
      'RCT on 26 completed.',
      ctx,
    );

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain('models/gemini-2.0-flash:generateContent');
    expect(String(url)).toContain('key=GK');

    const body = JSON.parse(String(init?.body));
    expect(body.systemInstruction.parts[0].text).toContain('Akhilesh');
    expect(body.systemInstruction.parts[0].text).toContain('Penicillin'); // allergy injected
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema).toBeTruthy();
    expect(body.generationConfig.responseSchema.type).toBe('OBJECT');
    expect(body.contents[0].parts[0].text).toContain('RCT on 26');

    expect(r.procedure).toBe('RCT');
    expect(r.teeth).toContain(26);
  });

  it('throws a clear error on malformed JSON in the model response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiOk('{ not valid json ]'));
    await expect(
      new GeminiExtractor({ apiKey: 'GK' }).extractClinical('anything', ctx),
    ).rejects.toThrow(/malformed JSON/i);
  });

  it('throws when the API returns a non-2xx (no-retry path)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('quota', { status: 429 }));
    await expect(
      new GeminiExtractor({ apiKey: 'GK', maxRetries: 0 }).extractClinical('anything', ctx),
    ).rejects.toThrow(/Gemini/i);
  });

  it('truncates an over-long transcript to respect the input-token budget', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiOk(VALID_CLINICAL));
    await new GeminiExtractor({ apiKey: 'GK' }).extractClinical('a'.repeat(10_000), ctx);
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]?.body));
    expect(body.contents[0].parts[0].text.length).toBeLessThanOrEqual(4000);
  });

  it('throws when not configured (no API key)', () => {
    expect(() => new GeminiExtractor({ apiKey: '' })).toThrow(/not configured/);
  });
});

describe('getExtractor factory', () => {
  const prev = { ...process.env };
  afterEach(() => {
    process.env.AI_PROVIDER = prev.AI_PROVIDER;
    process.env.GEMINI_API_KEY = prev.GEMINI_API_KEY;
  });

  it('returns the mock extractor by default', () => {
    process.env.AI_PROVIDER = 'mock';
    expect(getExtractor()).toBeInstanceOf(MockExtractor);
  });

  it('returns the Gemini extractor when AI_PROVIDER=gemini', () => {
    process.env.AI_PROVIDER = 'gemini';
    process.env.GEMINI_API_KEY = 'GK';
    expect(getExtractor()).toBeInstanceOf(GeminiExtractor);
  });
});
