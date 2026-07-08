import { describe, expect, it } from 'vitest';
import { PatientIntakeExtraction } from '@odovox/types';

/**
 * Regression (Phase 9.5): the "Speak patient details" flow prefills the new-patient form from the
 * POST /patients/intake/dictate response. The form (app/(app)/patients/new/page.tsx) reads exactly
 * these fields off `data.intake`: name, phone, age, gender, medicalFlags. If the extractor's output
 * shape drifts (e.g. medicalFlags → medical_flags), the form silently fills nothing. This pins the
 * contract to the shared @odovox/types schema so any drift fails here instead of in the browser.
 */

// The fields the form actually consumes (keep in lockstep with patients/new/page.tsx).
// Phase 9.6 Issue 2 added chiefComplaint + allergies — the form now reads all seven.
const FORM_READS = ['name', 'phone', 'age', 'gender', 'chiefComplaint', 'medicalFlags', 'allergies'] as const;

describe('intake extraction shape ↔ new-patient form contract', () => {
  it('a realistic extractor response carries every field the form reads', () => {
    // Shape mirrors what dictate.ts returns under `data.intake` (schema-validated on the server).
    const intake = PatientIntakeExtraction.parse({
      name: 'Ramesh Kumar',
      phone: '9876543210',
      age: 34,
      gender: 'MALE',
      chiefComplaint: 'tooth pain left side',
      medicalFlags: ['Diabetes'],
      allergies: ['Penicillin'],
    });

    for (const key of FORM_READS) {
      expect(intake, `intake is missing "${key}" the form depends on`).toHaveProperty(key);
    }

    // The exact destructuring + guards the form performs must yield the spoken values.
    const filled: Record<string, unknown> = {};
    if (intake.name) filled.name = intake.name;
    if (intake.phone) filled.phone = intake.phone;
    if (intake.age) filled.age = intake.age;
    if (intake.gender) filled.gender = intake.gender;
    if (intake.chiefComplaint) filled.chiefComplaint = intake.chiefComplaint;
    if (intake.medicalFlags.length) filled.medicalFlags = intake.medicalFlags;
    if (intake.allergies.length) filled.allergies = intake.allergies.join(', ');

    expect(filled).toEqual({
      name: 'Ramesh Kumar',
      phone: '9876543210',
      age: 34,
      gender: 'MALE',
      chiefComplaint: 'tooth pain left side',
      medicalFlags: ['Diabetes'],
      allergies: 'Penicillin',
    });
  });

  it('an all-null intake (nothing recognised) leaves the form untouched rather than throwing', () => {
    const intake = PatientIntakeExtraction.parse({});
    const filled: Record<string, unknown> = {};
    if (intake.name) filled.name = intake.name;
    if (intake.age) filled.age = intake.age;
    if (intake.medicalFlags.length) filled.medicalFlags = intake.medicalFlags;
    expect(filled).toEqual({});
  });
});
