import { describe, expect, it } from 'vitest';
import type { ClinicalExtractionContext } from '@odovox/types';
import { buildClinicalSystemInstruction } from '../src/lib/ai/prompts/clinical.js';
import { MockExtractor } from '../src/lib/ai/mock-extractor.js';

function ctx(over: Partial<ClinicalExtractionContext> = {}): ClinicalExtractionContext {
  return {
    name: 'Asha',
    age: 40,
    gender: 'FEMALE',
    allergies: [],
    medicalFlags: [],
    currentPlanSummary: null,
    lastVisitSummary: null,
    chiefComplaint: null,
    activePlans: [],
    ...over,
  };
}

const RCT_PLAN = {
  planId: 'plan_abc123',
  procedureName: 'RCT',
  teeth: [26],
  completedSittings: 2,
  totalSittings: 4,
  startedAt: '2026-06-18T09:00:00.000Z',
};

describe('clinical prompt — active plan context', () => {
  it('embeds the active plans JSON and the continuation instructions', () => {
    const prompt = buildClinicalSystemInstruction(ctx({ activePlans: [RCT_PLAN] }));
    expect(prompt).toContain('ACTIVE TREATMENT PLANS');
    expect(prompt).toContain('plan_abc123');
    expect(prompt).toContain('"completedSittings":2');
    expect(prompt).toContain('continuesPlanId');
    expect(prompt).toContain('NEVER assume continuation');
  });

  it('renders an empty array when the patient has no active plans', () => {
    const prompt = buildClinicalSystemInstruction(ctx());
    expect(prompt).toContain('ACTIVE TREATMENT PLANS');
    expect(prompt).toMatch(/ACTIVE TREATMENT PLANS[^\n]*\n\[\]/);
  });
});

describe('MockExtractor — continuation detection', () => {
  it('flags continuesPlanId when the same procedure + tooth continues an active plan', async () => {
    const r = await new MockExtractor().extractClinical(
      'Continuing RCT on 26, third sitting done.',
      ctx({ activePlans: [RCT_PLAN] }),
    );
    expect(r.continuesPlanId).toBe('plan_abc123');
    expect(r.sittingCurrent).toBe(3);
  });

  it('defaults sittingCurrent to completedSittings + 1 when no explicit sitting spoken', async () => {
    const r = await new MockExtractor().extractClinical(
      'Continuing the root canal, cleaned and shaped further.',
      ctx({ activePlans: [RCT_PLAN] }),
    );
    expect(r.continuesPlanId).toBe('plan_abc123');
    expect(r.sittingCurrent).toBe(3);
  });

  it('does NOT continue when the tooth differs from the active plan', async () => {
    const r = await new MockExtractor().extractClinical(
      'RCT started on 36 today.',
      ctx({ activePlans: [RCT_PLAN] }),
    );
    expect(r.continuesPlanId).toBeNull();
  });

  it('does NOT continue when the doctor explicitly starts a new plan', async () => {
    const r = await new MockExtractor().extractClinical(
      'Starting a new RCT on 26, first sitting.',
      ctx({ activePlans: [RCT_PLAN] }),
    );
    expect(r.continuesPlanId).toBeNull();
  });

  it('does NOT continue when the procedure differs (extraction vs RCT)', async () => {
    const r = await new MockExtractor().extractClinical(
      'Extraction of 26 done today.',
      ctx({ activePlans: [RCT_PLAN] }),
    );
    expect(r.continuesPlanId).toBeNull();
  });
});
