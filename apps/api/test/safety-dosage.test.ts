import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { runSafetyChecks } from '../src/lib/ai/safety.js';

describe('safety: dosage sanity', () => {
  it('flags an adult-range dose for a child under 12', () => {
    const extracted = ClinicalExtraction.parse({
      prescriptions: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 }],
    });
    const result = runSafetyChecks(extracted, { age: 8, medicalFlags: [] }, []);
    expect(result.warnings.some((w) => w.code === 'pediatric_dosage')).toBe(true);
  });

  it('flags an antibiotic prescribed for more than 14 days', () => {
    const extracted = ClinicalExtraction.parse({
      prescriptions: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 21 }],
    });
    const result = runSafetyChecks(extracted, { age: 40, medicalFlags: [] }, []);
    expect(result.warnings.some((w) => w.code === 'antibiotic_duration')).toBe(true);
  });
});
