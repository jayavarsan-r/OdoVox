import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { runSafetyChecks } from '../src/lib/ai/safety.js';

describe('safety: allergy cross-check', () => {
  it('flags a penicillin allergy when Amoxicillin is prescribed (warn, never block)', () => {
    const extracted = ClinicalExtraction.parse({
      prescriptions: [{ name: 'Amoxicillin', dosage: '500mg', frequency: 'TID', durationDays: 5 }],
    });

    const result = runSafetyChecks(extracted, { age: 34, medicalFlags: [] }, ['Penicillin']);

    const warning = result.warnings.find((w) => w.code === 'allergy_conflict');
    expect(warning).toBeTruthy();
    expect(warning!.message).toMatch(/Amoxicillin/);
    expect(warning!.message).toMatch(/penicillin/i);
    // Safety warnings flag, never block.
    expect(result.blockingErrors).toEqual([]);
  });
});
