import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { runSafetyChecks } from '../src/lib/ai/safety.js';

describe('safety: tooth-number validation', () => {
  it('produces a BLOCKING error for an invalid FDI tooth (19)', () => {
    const extracted = ClinicalExtraction.parse({ procedure: 'RCT', teeth: [19] });
    const result = runSafetyChecks(extracted, { age: 30, medicalFlags: [] }, []);
    const err = result.blockingErrors.find((e) => e.code === 'invalid_tooth');
    expect(err).toBeTruthy();
    expect(err!.message).toMatch(/19/);
  });

  it('accepts valid FDI teeth (26, 38) with no blocking error', () => {
    const extracted = ClinicalExtraction.parse({ teeth: [26, 38] });
    const result = runSafetyChecks(extracted, { age: 30, medicalFlags: [] }, []);
    expect(result.blockingErrors).toEqual([]);
  });
});
