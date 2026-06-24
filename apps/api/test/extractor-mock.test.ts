import { describe, expect, it } from 'vitest';
import type { ClinicalExtractionContext } from '@odovox/types';
import { MockExtractor } from '../src/lib/ai/mock-extractor.js';

const ctx: ClinicalExtractionContext = {
  name: 'Akhilesh Guhan',
  age: 34,
  gender: 'MALE',
  allergies: [],
  medicalFlags: [],
  currentPlanSummary: null,
  lastVisitSummary: null,
  chiefComplaint: null,
};

const HEADLINE =
  'RCT on 26 completed, third sitting. Amoxicillin 500mg TID for 5 days. Review next week.';

describe('MockExtractor.extractClinical', () => {
  it('pattern-matches the procedure, tooth, sitting and status', async () => {
    const r = await new MockExtractor().extractClinical(HEADLINE, ctx);
    expect(r.procedure).toBe('RCT');
    expect(r.teeth).toContain(26);
    expect(r.sittingCurrent).toBe(3);
    expect(r.status).toBe('COMPLETED');
  });

  it('extracts the Amoxicillin prescription with dosage, frequency and duration', async () => {
    const r = await new MockExtractor().extractClinical(HEADLINE, ctx);
    expect(r.prescriptions).toHaveLength(1);
    expect(r.prescriptions[0]).toMatchObject({
      name: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'TID',
      durationDays: 5,
    });
  });

  it('reads "review next week" as a 7-day follow-up', async () => {
    const r = await new MockExtractor().extractClinical(HEADLINE, ctx);
    expect(r.followUp?.afterDays).toBe(7);
  });

  it('never invents a medicine the doctor did not mention', async () => {
    const r = await new MockExtractor().extractClinical('Scaling done, whole mouth.', ctx);
    expect(r.prescriptions).toEqual([]);
    expect(r.procedure).toBe('Scaling');
  });
});

describe('MockExtractor.extractPrescription', () => {
  it('extracts only medicines (no procedure/teeth)', async () => {
    const r = await new MockExtractor().extractPrescription(
      'Ibuprofen 400mg BD for 3 days after food.',
      { name: 'Akhilesh Guhan', age: 34, allergies: [], medicalFlags: [] },
    );
    expect(r.prescriptions).toHaveLength(1);
    expect(r.prescriptions[0]).toMatchObject({
      name: 'Ibuprofen',
      dosage: '400mg',
      frequency: 'BD',
      durationDays: 3,
    });
    expect(r.prescriptions[0]!.instructions).toMatch(/after food/i);
  });
});

describe('MockExtractor.extractPatientIntake', () => {
  it('pulls demographics and chief complaint', async () => {
    const r = await new MockExtractor().extractPatientIntake(
      'New patient Akhilesh Guhan, 34 year old male, complains of pain in the upper right tooth. He is diabetic.',
    );
    expect(r.name).toMatch(/Akhilesh/);
    expect(r.age).toBe(34);
    expect(r.gender).toBe('MALE');
    expect(r.chiefComplaint).toMatch(/pain/i);
    expect(r.medicalFlags.join(' ')).toMatch(/diab/i);
  });
});
