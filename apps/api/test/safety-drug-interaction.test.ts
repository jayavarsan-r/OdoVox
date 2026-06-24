import { describe, expect, it } from 'vitest';
import { ClinicalExtraction } from '@odovox/types';
import { runSafetyChecks } from '../src/lib/ai/safety.js';

describe('safety: drug interactions', () => {
  it('flags Metronidazole against an alcohol-use flag', () => {
    const extracted = ClinicalExtraction.parse({
      prescriptions: [{ name: 'Metronidazole', dosage: '400mg', frequency: 'TID', durationDays: 5 }],
    });
    const result = runSafetyChecks(extracted, { age: 40, medicalFlags: ['Alcohol use'] }, []);
    expect(result.warnings.some((w) => w.code === 'drug_interaction')).toBe(true);
  });

  it('flags an NSAID (Ibuprofen) for a patient on Warfarin', () => {
    const extracted = ClinicalExtraction.parse({
      prescriptions: [{ name: 'Ibuprofen', dosage: '400mg', frequency: 'BD', durationDays: 3 }],
    });
    const result = runSafetyChecks(extracted, { age: 60, medicalFlags: ['On Warfarin'] }, []);
    expect(result.warnings.some((w) => w.code === 'drug_interaction')).toBe(true);
  });

  it('does not flag when there is no known interaction', () => {
    const extracted = ClinicalExtraction.parse({
      prescriptions: [{ name: 'Paracetamol', dosage: '500mg', frequency: 'TID', durationDays: 3 }],
    });
    const result = runSafetyChecks(extracted, { age: 30, medicalFlags: [] }, []);
    expect(result.warnings.some((w) => w.code === 'drug_interaction')).toBe(false);
  });
});
