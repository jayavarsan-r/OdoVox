import { describe, expect, it } from 'vitest';
import { verificationSource } from './verification-sources';

/**
 * Phase 9.6 Issue 16: before anything commits, the doctor sees a Preview — the exact summary
 * (procedure · teeth · sitting, prescription, follow-up, fee, notes) with "Edit more" to go back.
 * Confirm only fires from inside the preview.
 */

const card = verificationSource();

describe('verification card — preview before save', () => {
  it('the primary CTA opens the preview (no direct commit)', () => {
    // Frame 27 renames it "Confirm & save". The old label collided with the recorder's
    // STOPPED button, which also read "Save findings" for a completely different action —
    // send audio for processing vs commit the clinical record.
    expect(card).toContain('Confirm & save');
    // The CTA opens the preview; it never calls confirm(). Task 17 moved the button into
    // <SaveActions onOpenPreview={...}/>, so the handler now reads as the prop rather
    // than an inline onClick — same guarantee, one indirection later.
    expect(card).toMatch(/onOpenPreview=\{\(\) => setPreview\(true\)\}/);
    expect(card).not.toContain("'Confirm & send to front desk'");
  });

  it('the preview summarises procedure, prescription, follow-up, fee and notes', () => {
    // These were five hand-written <PreviewLine label="..."> literals; Task 17 moved them
    // into previewLines() in lib/consult/card-view.ts, where their VALUES are now asserted
    // directly (card-view.test.ts) instead of only their labels being grepped. This keeps
    // the "all five are summarised" guarantee against the source that renders them.
    for (const label of ['Procedure', 'Prescription', 'Follow-up', 'Fee', 'Notes']) {
      // Quote-agnostic: the formatter owns quote style, and a guard that breaks on
      // prettier's preference is a guard nobody trusts.
      expect(card).toMatch(new RegExp(`label: ['"]${label}['"]`));
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
