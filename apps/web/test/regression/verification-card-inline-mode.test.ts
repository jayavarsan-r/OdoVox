import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { verificationSource } from './verification-sources';

/**
 * Phase 9.6 Issue 6: the verification card is the doctor's MAIN working surface — full-page and
 * in-flow on /consult/[id] — not a bottom sheet floating over a dimmed recorder.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'app', '(app)', 'consult', '[id]', 'page.tsx'), 'utf8');
const card = verificationSource();

describe('verification card — inline full-page mode', () => {
  it('the consult page renders the card in-flow, not as a fixed bottom overlay', () => {
    expect(page).not.toMatch(/fixed inset-x-0 bottom-0/);
    expect(page).toMatch(/isVerify \?[\s\S]*?<VerificationCard/);
  });

  it('the card grows to fill the page (no sheet-only rounding)', () => {
    // Frames 27-30 drop the single glass shell: the content sits on paper with its own
    // tiles, so there is no longer one rounded container to assert. What still matters —
    // and what Issue 6 was actually about — is that this is a full-page surface and not a
    // bottom sheet floating over a dimmed recorder.
    expect(card).toMatch(/flex max-h-full min-h-0 flex-1 flex-col/);
    expect(card).not.toMatch(/rounded-b-none/);
    expect(card).not.toMatch(/fixed inset-x-0 bottom-0/);
  });

  it('the patient identity stays visible on the verification surface', () => {
    // It moved INTO the card (frame 27's header line) rather than sitting above it as a
    // second context card — but it is still there, and still sourced from the patient DB
    // record rather than the extraction.
    expect(page).toMatch(/patientName=\{context\?\.patient\.name/);
    expect(card).toMatch(/patientName/);
  });

  it('the card carries editable Fee and Notes rows (dictated cost/advice have a home)', () => {
    expect(card).toMatch(/label="Fee"/);
    expect(card).toMatch(/label="Notes"/);
    expect(card).toMatch(/setCost\(data,/);
    expect(card).toMatch(/setNotes\(data,/);
  });
});
