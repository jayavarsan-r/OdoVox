import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { ClinicalExtraction } from '@odovox/types';

/**
 * Phase 9.6 Issue 5: the "{name} · {age} · token" identity block must come from the patient DB
 * record (GET /consultations context.patient), never from extraction output — so even a
 * hallucinating extractor can't paint a wrong age onto the card.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const card = readFileSync(join(webRoot, 'components', 'voice', 'verification-card.tsx'), 'utf8');
const contextCard = readFileSync(join(webRoot, 'components', 'consult', 'patient-context-card.tsx'), 'utf8');

describe('verification card — identity renders from the patient record only', () => {
  it('the extraction contract has no identity fields for the card to even read', () => {
    const parsed = ClinicalExtraction.parse({ procedure: 'RCT', name: 'Priya', age: 42 });
    expect(parsed).not.toHaveProperty('name');
    expect(parsed).not.toHaveProperty('age');
  });

  it('the verification card never renders name/age/phone off the extraction data', () => {
    expect(card).not.toMatch(/data\.name\b/);
    expect(card).not.toMatch(/data\.age\b/);
    expect(card).not.toMatch(/data\.phone\b/);
    expect(card).not.toMatch(/data\.gender\b/);
  });

  it('the identity strip reads from the consultation context patient (DB row)', () => {
    expect(contextCard).toMatch(/patient\.name/);
    expect(contextCard).toMatch(/patient\.age/);
  });
});
