import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { runSafetyChecks } from '../src/lib/ai/safety.js';

describe('safety: sitting counts', () => {
  it('warns when the current sitting exceeds the total (3 of 2)', () => {
    const extracted = ClinicalExtraction.parse({ sittingCurrent: 3, sittingTotal: 2 });
    const result = runSafetyChecks(extracted, { age: 30, medicalFlags: [] }, []);
    expect(result.warnings.some((w) => w.code === 'sitting_overflow')).toBe(true);
  });

  it('warns on a sitting jump past the plan’s expected next sitting', () => {
    const extracted = ClinicalExtraction.parse({ sittingCurrent: 5, sittingTotal: 6 });
    const result = runSafetyChecks(
      extracted,
      { age: 30, medicalFlags: [] },
      [],
      { expectedNextSitting: 3 },
    );
    expect(result.warnings.some((w) => w.code === 'sitting_jump')).toBe(true);
  });
});
