import { describe, expect, it } from 'vitest';
import {
  ClinicalExtraction,
  ExtractedPrescription,
  MedicineFrequency,
  PatientIntakeExtraction,
} from './extraction.js';

describe('ClinicalExtraction', () => {
  it('fills array + nullable defaults from a minimal object', () => {
    const parsed = ClinicalExtraction.parse({});
    expect(parsed.teeth).toEqual([]);
    expect(parsed.prescriptions).toEqual([]);
    expect(parsed.toothStatusUpdates).toEqual([]);
    expect(parsed.clarifications).toEqual([]);
    expect(parsed.safetyWarnings).toEqual([]);
    expect(parsed.procedure).toBeNull();
    expect(parsed.followUp).toBeNull();
  });

  it('accepts an out-of-range tooth so the safety layer can flag it (not FDI-validated here)', () => {
    // 19 and 30 are not valid FDI teeth, but parsing must succeed — the safety layer turns
    // these into blocking errors on the verification card; Zod must not reject them first.
    const parsed = ClinicalExtraction.parse({ teeth: [19, 30] });
    expect(parsed.teeth).toEqual([19, 30]);
  });
});

describe('ExtractedPrescription', () => {
  it('requires a name but allows null dosage / frequency / duration', () => {
    const parsed = ExtractedPrescription.parse({ name: 'Amoxicillin' });
    expect(parsed.name).toBe('Amoxicillin');
    expect(parsed.dosage).toBeNull();
    expect(parsed.frequency).toBeNull();
    expect(parsed.durationDays).toBeNull();
    expect(ExtractedPrescription.safeParse({ dosage: '500mg' }).success).toBe(false);
  });

  it('only allows the OD/BD/TID/QID/SOS frequency vocabulary', () => {
    expect(MedicineFrequency.safeParse('TID').success).toBe(true);
    expect(MedicineFrequency.safeParse('twice').success).toBe(false);
  });
});

describe('PatientIntakeExtraction', () => {
  it('defaults medicalFlags + clarifications to empty arrays', () => {
    const parsed = PatientIntakeExtraction.parse({ name: 'Akhilesh' });
    expect(parsed.medicalFlags).toEqual([]);
    expect(parsed.clarifications).toEqual([]);
    expect(parsed.age).toBeNull();
  });
});
