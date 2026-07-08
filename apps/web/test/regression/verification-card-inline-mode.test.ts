import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.6 Issue 6: the verification card is the doctor's MAIN working surface — full-page and
 * in-flow on /consult/[id] — not a bottom sheet floating over a dimmed recorder.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'app', '(app)', 'consult', '[id]', 'page.tsx'), 'utf8');
const card = readFileSync(join(webRoot, 'components', 'voice', 'verification-card.tsx'), 'utf8');

describe('verification card — inline full-page mode', () => {
  it('the consult page renders the card in-flow, not as a fixed bottom overlay', () => {
    expect(page).not.toMatch(/fixed inset-x-0 bottom-0/);
    expect(page).toMatch(/isVerify \?[\s\S]*?<VerificationCard/);
  });

  it('the card shell grows to fill the page (no sheet-only rounding)', () => {
    expect(card).toMatch(/flex-1 flex-col overflow-hidden rounded-3xl/);
    expect(card).not.toMatch(/rounded-b-none/);
  });

  it('the patient identity strip stays visible on the verification surface', () => {
    expect(page).toMatch(/\(isRecorder && !recording\) \|\| isVerify/);
  });

  it('the card carries editable Fee and Notes rows (dictated cost/advice have a home)', () => {
    expect(card).toMatch(/label="Fee"/);
    expect(card).toMatch(/label="Notes"/);
    expect(card).toMatch(/setCost\(data,/);
    expect(card).toMatch(/setNotes\(data,/);
  });
});
