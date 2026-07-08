import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.6 Issue 16: before anything commits, the doctor sees a Preview — the exact summary
 * (procedure · teeth · sitting, prescription, follow-up, fee, notes) with "Edit more" to go back.
 * Confirm only fires from inside the preview.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const card = readFileSync(join(webRoot, 'components', 'voice', 'verification-card.tsx'), 'utf8');

describe('verification card — preview before save', () => {
  it('the primary CTA is "Save findings" and opens the preview (no direct commit)', () => {
    expect(card).toContain('Save findings');
    expect(card).toMatch(/onClick=\{\(\) => setPreview\(true\)\}/);
    expect(card).not.toContain("'Confirm & send to front desk'");
  });

  it('the preview summarises procedure, prescription, follow-up, fee and notes', () => {
    for (const label of ['Procedure', 'Prescription', 'Follow-up', 'Fee', 'Notes']) {
      expect(card).toContain(`label="${label}"`);
    }
  });

  it('confirm fires only from inside the preview, with Edit more as the way back', () => {
    expect(card).toContain('Edit more');
    expect(card).toMatch(/Save &amp; send to front desk/);
    const previewBlock = card.slice(card.indexOf('{preview && !blocked ?'));
    expect(previewBlock).toMatch(/confirm\(\)\.catch/);
  });

  it('a server-side blocking error dismisses the preview so the red rows show', () => {
    expect(card).toMatch(/\{preview && !blocked \? \(/);
  });
});
