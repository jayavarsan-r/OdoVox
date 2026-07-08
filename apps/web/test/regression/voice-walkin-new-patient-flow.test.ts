import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { PatientIntakeExtraction } from '@odovox/types';

/**
 * Phase 9.6 Issue 4 — voice walk-in, NEW patient path. "New patient" opens an in-sheet
 * voice-add: dictation prefills a 4-field verification form (name/phone/age/gender + complaint),
 * Create makes the patient in the DB, and the flow continues straight into the doctor step —
 * never routing away from the sheet, never dropping the queue add.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sheet = readFileSync(join(webRoot, 'components', 'queue', 'walk-in-sheet.tsx'), 'utf8');

describe('voice walk-in — new patient path', () => {
  it('dictation prefills every field of the mini-form', () => {
    expect(sheet).toMatch(/if \(intake\.name\) setNpName\(intake\.name\)/);
    expect(sheet).toMatch(/if \(intake\.phone\) setNpPhone\(intake\.phone\)/);
    expect(sheet).toMatch(/if \(intake\.age\) setNpAge\(String\(intake\.age\)\)/);
    expect(sheet).toMatch(/if \(intake\.gender\) setNpGender\(intake\.gender\)/);
    expect(sheet).toMatch(/if \(intake\.chiefComplaint\) setComplaint\(intake\.chiefComplaint\)/);
  });

  it('Create is gated on the 4 required fields via the shared Zod schema', () => {
    expect(sheet).toMatch(/CreatePatientInput\.safeParse\(/);
    expect(sheet).toMatch(/disabled=\{!npValid\}/);
  });

  it('creating the patient advances to the doctor step with the new patient selected', () => {
    expect(sheet).toMatch(/async function createAndContinue[\s\S]*?setPatient\(\{ id: created\.id, name: created\.name \}\)[\s\S]*?setStep\('doctor'\)/);
  });

  it('the intake contract carries every field the sheet reads', () => {
    const intake = PatientIntakeExtraction.parse({
      name: 'Lakshmi R',
      phone: '9876543211',
      age: 52,
      gender: 'FEMALE',
      chiefComplaint: 'loose crown',
    });
    for (const key of ['name', 'phone', 'age', 'gender', 'chiefComplaint'] as const) {
      expect(intake, `intake is missing "${key}" the sheet depends on`).toHaveProperty(key);
    }
  });
});
