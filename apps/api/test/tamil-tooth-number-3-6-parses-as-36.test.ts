import { describe, expect, it } from 'vitest';
import { MockExtractor } from '../src/lib/ai/mock-extractor.js';
import { buildClinicalSystemInstruction } from '../src/lib/ai/prompts/clinical.js';
import type { ClinicalExtractionContext } from '@odovox/types';

/**
 * Phase 9.6 Issue 8: "3 6 la" is tooth 36 (Tanglish separated-digit dictation), NOT teeth 3 and 6
 * and NOT tooth 16. Pins both layers: the Gemini prompt teaches the pattern, and the extractor
 * contract (exercised through the mock, which mirrors the prompt rules) resolves the pair.
 */

const ctx: ClinicalExtractionContext = {
  name: 'Ravi',
  age: 30,
  gender: 'MALE',
  allergies: [],
  medicalFlags: [],
  currentPlanSummary: null,
  lastVisitSummary: null,
  chiefComplaint: null,
  activePlans: [],
};

describe('Tamil separated-digit tooth numbers', () => {
  it('the clinical prompt teaches "3 6 la" → tooth 36', () => {
    const prompt = buildClinicalSystemInstruction(ctx);
    expect(prompt).toContain('TAMIL/TANGLISH TOOTH NUMBER PATTERNS');
    expect(prompt).toContain('"3 6" means tooth 36');
    expect(prompt).toContain('panniaachu');
    expect(prompt).toContain('vechikalam');
  });

  it('"3 6 la" extracts tooth 36 (not 3, 6, or 16)', async () => {
    const extraction = await new MockExtractor().extractClinical('patient ku 3 6 la root canal pannanum', ctx);
    expect(extraction.teeth).toEqual([36]);
    expect(extraction.procedure).toBe('RCT');
  });

  it('"1 6" extracts tooth 16; "4 7" extracts tooth 47', async () => {
    const a = await new MockExtractor().extractClinical('deep caries 1 6 la filling pannanum', ctx);
    expect(a.teeth).toEqual([16]);
    const b = await new MockExtractor().extractClinical('extraction needed 4 7 tooth', ctx);
    expect(b.teeth).toEqual([47]);
  });

  it('does not join digits that belong to durations ("5 days", "2 weeks")', async () => {
    const extraction = await new MockExtractor().extractClinical(
      'scaling done, review after 2 weeks, paracetamol for 5 days',
      ctx,
    );
    expect(extraction.teeth).toEqual([]);
  });
});
