import { describe, expect, it } from 'vitest';
import { PatientIntakeExtraction } from '@odovox/types';
import { MockExtractor } from '../src/lib/ai/mock-extractor.js';
import { INTAKE_RESPONSE_SCHEMA } from '../src/lib/ai/response-schema.js';
import { PATIENT_INTAKE_SYSTEM_INSTRUCTION } from '../src/lib/ai/prompts/clinical.js';

/**
 * Phase 9.6 Issue 2: medical flags, allergies, and the chief complaint were extracted but never
 * reached the patient form — the chain broke between extractor output and form fields. This pins
 * every link on the server side: the Zod contract, the Gemini responseSchema, the prompt, and the
 * mock extractor all carry the same field set.
 */
describe('intake extraction carries every field the form populates', () => {
  it('the Zod contract includes chiefComplaint, medicalFlags AND allergies', () => {
    const parsed = PatientIntakeExtraction.parse({
      name: 'Meena K',
      phone: '9876504321',
      age: 45,
      gender: 'FEMALE',
      chiefComplaint: 'sensitivity in lower left molar',
      medicalFlags: ['Diabetes'],
      allergies: ['Penicillin'],
    });
    expect(parsed.chiefComplaint).toBe('sensitivity in lower left molar');
    expect(parsed.medicalFlags).toEqual(['Diabetes']);
    expect(parsed.allergies).toEqual(['Penicillin']);
  });

  it('the Gemini responseSchema requests allergies (so the model can return them)', () => {
    const props = INTAKE_RESPONSE_SCHEMA.properties as Record<string, unknown>;
    expect(props.allergies).toBeTruthy();
    expect(INTAKE_RESPONSE_SCHEMA.required).toContain('allergies');
  });

  it('the intake prompt asks for allergies', () => {
    expect(PATIENT_INTAKE_SYSTEM_INSTRUCTION).toMatch(/allergies/i);
  });

  it('a rich spoken introduction extracts demographics + complaint + flags + allergies', async () => {
    const extractor = new MockExtractor();
    const intake = await extractor.extractPatientIntake(
      'New patient Meena Kumari, 45 years old female, 9876504321, complains of sensitivity in lower left molar. She is diabetic and allergic to penicillin.',
    );
    expect(intake.name).toBe('Meena Kumari');
    expect(intake.age).toBe(45);
    expect(intake.gender).toBe('FEMALE');
    expect(intake.phone).toBe('9876504321');
    expect(intake.chiefComplaint).toMatch(/sensitivity/i);
    expect(intake.medicalFlags).toContain('Diabetes');
    expect(intake.allergies).toContain('Penicillin');
  });
});
