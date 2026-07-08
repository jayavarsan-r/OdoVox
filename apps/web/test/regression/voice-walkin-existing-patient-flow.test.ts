import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.6 Issue 4 — voice walk-in, existing-patient path. The FAB opens a TYPE PICKER
 * (Existing / New); "Existing patient" starts a voice search whose extracted name/phone drives
 * the patient list, and picking a patient moves to the doctor (visit details) step.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const sheet = readFileSync(join(webRoot, 'components', 'queue', 'walk-in-sheet.tsx'), 'utf8');

describe('voice walk-in — type picker + existing patient path', () => {
  it('the voice FAB path opens on a type picker with both options', () => {
    expect(sheet).toMatch(/step \?\? \(voice \? 'type' : 'patient'\)/);
    expect(sheet).toContain('Existing patient');
    expect(sheet).toContain('Voice-search by name or phone');
    expect(sheet).toContain('New patient');
    expect(sheet).toContain('Voice-add patient details');
  });

  it('"Existing patient" enables voice search and moves to the patient step', () => {
    expect(sheet).toMatch(/setVoiceSearch\(true\);\s*setStep\('patient'\)/);
    expect(sheet).toMatch(/autoStart=\{open && voiceSearch\}/);
  });

  it('voice search extraction drives the patient search field', () => {
    expect(sheet).toMatch(/endpoint="\/queue\/walkin\/dictate"/);
    expect(sheet).toMatch(/setSearch\(intake\.name \?\? intake\.phone \?\? transcript\.trim\(\)\)/);
  });

  it('picking a patient advances to the doctor step (visit details)', () => {
    expect(sheet).toMatch(/function pickPatient[\s\S]*?setStep\('doctor'\)/);
  });
});
