import { describe, expect, it, vi, afterEach } from 'vitest';
import { GeminiExtractor } from '../src/lib/ai/gemini-extractor.js';

afterEach(() => vi.restoreAllMocks());

const ctx = {
  name: 'Akhilesh',
  age: 34,
  gender: 'MALE',
  allergies: ['Penicillin'],
  medicalFlags: [],
  currentPlanSummary: null,
  lastVisitSummary: null,
  chiefComplaint: 'Tooth pain',
};

// The real Gemini envelope wraps the JSON-as-string in candidates[0].content.parts[0].text.
const geminiEnvelope = (jsonText: string, finishReason = 'STOP'): Response =>
  new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: jsonText }] }, finishReason }] }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

const VALID_CLINICAL = JSON.stringify({
  procedure: 'RCT',
  teeth: [26],
  sittingCurrent: 3,
  sittingTotal: 4,
  status: 'IN_PROGRESS',
  prescriptions: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5, instructions: null }],
  followUp: { afterDays: 7, procedureHint: null },
  toothStatusUpdates: [],
  notes: null,
  clarifications: [],
  safetyWarnings: [],
});

describe('Gemini response parsing', () => {
  it('unwraps candidates[0].content.parts[0].text and JSON.parses it', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiEnvelope(VALID_CLINICAL));
    const result = await new GeminiExtractor({ apiKey: 'GK_test_1234567890', model: 'gemini-2.5-flash' }).extractClinical(
      'RCT on 26, third sitting',
      ctx,
    );
    expect(result.procedure).toBe('RCT');
    expect(result.teeth).toContain(26);
    expect(result.prescriptions[0]!.name).toBe('Amoxicillin');
  });

  it('surfaces the finishReason when the inner text is truncated/malformed (MAX_TOKENS case)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(geminiEnvelope('{"teeth":[26],"pres', 'MAX_TOKENS'));
    await expect(
      new GeminiExtractor({ apiKey: 'GK_test_1234567890', model: 'gemini-2.5-flash' }).extractClinical('x', ctx),
    ).rejects.toThrow(/MAX_TOKENS/);
  });
});
