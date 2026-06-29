import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { runSafetyChecks } from '../src/lib/ai/safety.js';

const base = (over: Record<string, unknown>) =>
  ClinicalExtraction.parse({ procedure: 'RCT', teeth: [26], ...over });

const patient = { age: 35, medicalFlags: [] as string[] };

describe('multi-sitting overflow — safety warns, never blocks', () => {
  it('flags sitting_overflow when completedSittings + 1 would exceed totalSittings', () => {
    // Plan is at 4/4; recording sitting 5 overshoots the total.
    const result = runSafetyChecks(base({ sittingCurrent: 5, sittingTotal: 4 }), patient, []);
    expect(result.blockingErrors).toHaveLength(0);
    expect(result.warnings.map((w) => w.code)).toContain('sitting_overflow');
  });

  it('flags sitting_jump against the plan-derived expected next sitting', () => {
    const result = runSafetyChecks(
      base({ sittingCurrent: 4, sittingTotal: 4 }),
      patient,
      [],
      { expectedNextSitting: 2 },
    );
    expect(result.warnings.map((w) => w.code)).toContain('sitting_jump');
  });

  it('does not warn when the sitting is exactly the next one', () => {
    const result = runSafetyChecks(
      base({ sittingCurrent: 3, sittingTotal: 4 }),
      patient,
      [],
      { expectedNextSitting: 3 },
    );
    expect(result.warnings.map((w) => w.code)).not.toContain('sitting_jump');
    expect(result.warnings.map((w) => w.code)).not.toContain('sitting_overflow');
  });
});
