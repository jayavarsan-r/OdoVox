import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { runSafetyChecks } from '../src/lib/ai/safety.js';

describe('safety: pregnancy flag', () => {
  it('flags Ibuprofen for a pregnant patient', () => {
    const extracted = ClinicalExtraction.parse({
      prescriptions: [{ name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 3 }],
    });
    const result = runSafetyChecks(extracted, { age: 28, medicalFlags: ['Pregnancy'] }, []);
    expect(result.warnings.some((w) => w.code === 'pregnancy_risk')).toBe(true);
  });
});
