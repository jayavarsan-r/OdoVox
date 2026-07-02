import { describe, expect, it } from 'vitest';
import type { ActivePlanContext, ClinicalExtraction, ClinicalExtractionContext } from '@odovox/types';
import {
  buildClinicalSystemInstruction,
  CLINICAL_PROMPT_VERSION,
} from '../src/lib/ai/prompts/clinical.js';
import { MockExtractor } from '../src/lib/ai/mock-extractor.js';

/**
 * Phase 5 Stage 5 — clinical extraction hardening.
 *
 * 20 realistic dental-dictation fixtures run against the deterministic MockExtractor (same input ->
 * same output, "the mock isn't lying"). They lock in the extraction surface — procedure, FDI teeth,
 * multi-sitting + plan continuation, prescriptions, follow-up, status, tooth-status updates — and
 * guard the never-invent rules. A second block asserts the hardened prompt actually carries the
 * guardrail wording so a future edit can't quietly soften it.
 */

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

const RCT_26_PLAN: ActivePlanContext = {
  planId: 'plan_rct26',
  procedureName: 'RCT',
  teeth: [26],
  completedSittings: 2,
  totalSittings: 4,
  startedAt: '2026-06-18T09:00:00.000Z',
};

interface Fixture {
  readonly name: string;
  readonly transcript: string;
  readonly ctx?: Partial<ClinicalExtractionContext>;
  readonly expect: (r: ClinicalExtraction) => void;
}

const FIXTURES: readonly Fixture[] = [
  {
    name: '01 — single-tooth RCT marks the tooth as RCT',
    transcript: 'Started RCT on 26 today.',
    expect: (r) => {
      expect(r.procedure).toBe('RCT');
      expect(r.teeth).toEqual([26]);
      expect(r.toothStatusUpdates).toEqual([{ tooth: 26, status: 'RCT', note: null }]);
    },
  },
  {
    name: '02 — full-mouth scaling has no tooth and completes',
    transcript: 'Full mouth scaling completed today.',
    expect: (r) => {
      expect(r.procedure).toBe('Scaling');
      expect(r.teeth).toEqual([]);
      expect(r.status).toBe('COMPLETED');
      expect(r.toothStatusUpdates).toEqual([]);
    },
  },
  {
    name: '03 — extraction marks tooth EXTRACTED and completed',
    transcript: 'Extraction of 38 done.',
    expect: (r) => {
      expect(r.procedure).toBe('Extraction');
      expect(r.teeth).toEqual([38]);
      expect(r.status).toBe('COMPLETED');
      expect(r.toothStatusUpdates).toEqual([{ tooth: 38, status: 'EXTRACTED', note: null }]);
    },
  },
  {
    name: '04 — explicit sitting "sitting 3 of 4"',
    transcript: 'RCT on 26, sitting 3 of 4 sittings.',
    expect: (r) => {
      expect(r.sittingCurrent).toBe(3);
      expect(r.sittingTotal).toBe(4);
    },
  },
  {
    name: '05 — slash notation "2/4 sittings"',
    transcript: 'Scaling 2/4 done.',
    expect: (r) => {
      expect(r.sittingCurrent).toBe(2);
      expect(r.sittingTotal).toBe(4);
    },
  },
  {
    name: '06 — continues an active plan (same procedure + tooth)',
    transcript: 'Continuing RCT on 26, cleaned and shaped further.',
    ctx: { activePlans: [RCT_26_PLAN] },
    expect: (r) => {
      expect(r.continuesPlanId).toBe('plan_rct26');
      expect(r.sittingCurrent).toBe(3); // completedSittings + 1
    },
  },
  {
    name: '07 — explicit "starting new" forces a fresh plan despite a match',
    transcript: 'Starting a new RCT on 26, first sitting.',
    ctx: { activePlans: [RCT_26_PLAN] },
    expect: (r) => {
      expect(r.continuesPlanId).toBeNull();
      expect(r.sittingCurrent).toBe(1);
    },
  },
  {
    name: '08 — does NOT continue when the tooth differs',
    transcript: 'RCT started on 36 today.',
    ctx: { activePlans: [RCT_26_PLAN] },
    expect: (r) => {
      expect(r.continuesPlanId).toBeNull();
      expect(r.teeth).toEqual([36]);
    },
  },
  {
    name: '09 — Hinglish code-mix extracts procedure + tooth',
    transcript: '26 number tooth ka RCT continue kiya, second sitting.',
    ctx: { activePlans: [RCT_26_PLAN] },
    expect: (r) => {
      expect(r.procedure).toBe('RCT');
      expect(r.teeth).toEqual([26]);
      expect(r.sittingCurrent).toBe(2);
    },
  },
  {
    name: '10 — spoken tooth number "twenty six"',
    transcript: 'Root canal on tooth twenty six today.',
    expect: (r) => {
      expect(r.teeth).toEqual([26]);
      expect(r.procedure).toBe('RCT');
    },
  },
  {
    name: '11 — full prescription line (dose/freq/duration/instructions)',
    transcript: 'Extraction 46 done. Amoxicillin 500mg TID for 5 days after food.',
    expect: (r) => {
      expect(r.prescriptions).toHaveLength(1);
      expect(r.prescriptions[0]).toMatchObject({
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'TID',
        durationDays: 5,
        instructions: 'after food',
      });
    },
  },
  {
    name: '12 — two medicines parsed independently',
    transcript: 'Amoxicillin 500mg BD for 5 days and Ibuprofen 400mg TID for 3 days.',
    expect: (r) => {
      expect(r.prescriptions.map((p) => p.name)).toEqual(['Amoxicillin', 'Ibuprofen']);
      expect(r.prescriptions[1]).toMatchObject({ dosage: '400mg', frequency: 'TID', durationDays: 3 });
    },
  },
  {
    name: '13 — follow-up "review after 7 days"',
    transcript: 'RCT on 26 in progress. Review after 7 days.',
    expect: (r) => {
      expect(r.followUp?.afterDays).toBe(7);
    },
  },
  {
    name: '14 — follow-up "next week" normalises to 7 days',
    transcript: 'Scaling done. Follow up next week.',
    expect: (r) => {
      expect(r.followUp?.afterDays).toBe(7);
    },
  },
  {
    name: '15 — status ABORTED',
    transcript: 'RCT on 26 aborted, patient was uncomfortable.',
    expect: (r) => {
      expect(r.status).toBe('ABORTED');
    },
  },
  {
    name: '16 — status IN_PROGRESS',
    transcript: 'RCT on 26 ongoing, will continue next visit.',
    expect: (r) => {
      expect(r.status).toBe('IN_PROGRESS');
    },
  },
  {
    name: '17 — crown fitting marks tooth CROWN',
    transcript: 'Crown fitting on 16 completed.',
    expect: (r) => {
      expect(r.procedure).toBe('Crown fitting');
      expect(r.toothStatusUpdates).toEqual([{ tooth: 16, status: 'CROWN', note: null }]);
    },
  },
  {
    name: '18 — composite filling marks tooth FILLED',
    transcript: 'Composite filling on 21 done.',
    expect: (r) => {
      expect(r.procedure).toBe('Filling');
      expect(r.toothStatusUpdates).toEqual([{ tooth: 21, status: 'FILLED', note: null }]);
    },
  },
  {
    name: '19 — procedure with no clear tooth raises a clarification',
    transcript: 'Did a root canal today.',
    expect: (r) => {
      expect(r.procedure).toBe('RCT');
      expect(r.teeth).toEqual([]);
      expect(r.clarifications.length).toBeGreaterThan(0);
    },
  },
  {
    name: '20 — never invents medicines from medical context',
    transcript: 'Patient is diabetic. RCT on 26 in progress.',
    expect: (r) => {
      expect(r.prescriptions).toEqual([]);
      expect(r.procedure).toBe('RCT');
    },
  },
];

describe('clinical extraction — 20 dictation fixtures', () => {
  const extractor = new MockExtractor();
  for (const f of FIXTURES) {
    it(f.name, async () => {
      const r = await extractor.extractClinical(f.transcript, ctx(f.ctx));
      f.expect(r);
    });
  }
});

describe('clinical prompt — hardening guardrails are present', () => {
  const prompt = buildClinicalSystemInstruction(ctx());

  it('is versioned v4 (9.7 lab-case suggestion)', () => {
    expect(CLINICAL_PROMPT_VERSION).toBe('clinical-v4');
  });

  it('lab-case suggestion is opt-in and never invented', () => {
    expect(prompt).toContain('LAB CASE SUGGESTION');
    expect(prompt).toContain('Never invent this');
  });

  it('states the valid FDI ranges and forbids silent correction', () => {
    expect(prompt).toContain('11-18, 21-28, 31-38, 41-48');
    expect(prompt).toMatch(/NEVER silently "correct"/i);
  });

  it('forbids inferring sittingTotal from the procedure type', () => {
    expect(prompt).toMatch(/sittingTotal: set it ONLY when the doctor states a total/);
  });

  it('forbids filling a standard/typical dose', () => {
    expect(prompt).toMatch(/Never fill in a "standard" or "typical" dose/);
  });

  it('treats PATIENT CONTEXT and ACTIVE PLANS as read-only', () => {
    expect(prompt).toContain('READ-ONLY CONTEXT');
    expect(prompt).toContain('output must come from today');
  });

  it('keeps the never-invent and allergy guardrails', () => {
    expect(prompt).toContain('NEVER prescribe medicines the doctor');
    expect(prompt).toContain('ALLERGY GUARDRAIL');
  });
});
