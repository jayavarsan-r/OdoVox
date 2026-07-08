import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.6 Issue 16: partial edits must never be lost. Every card edit PATCHes the draft to
 * /consultations/:id immediately (stronger than the spec's 10-second autosave), so a dropped tab
 * or a failed confirm never costs the doctor their corrections.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const store = readFileSync(join(webRoot, 'lib', 'consult', 'store.ts'), 'utf8');
const card = readFileSync(join(webRoot, 'components', 'voice', 'verification-card.tsx'), 'utf8');

describe('verification card — draft autosave', () => {
  it('the store PATCHes the consultation on every edit', () => {
    expect(store).toMatch(/edit: \(data\) => \{[\s\S]*?api\.patch\(`\/consultations\/\$\{consultationId\}`, toPatchBody\(data\)\)/);
  });

  it('every card edit funnels through the autosaving editor (medicines, lab case, fields)', () => {
    // Direct `edit(` calls would skip the dirty-tracking wrapper; only applyEdit/apply may call it.
    const directEdits = card.match(/[^y]\bedit\(/g) ?? [];
    expect(directEdits, 'card must route edits through applyEdit (dirty-tracking + autosave)').toHaveLength(1); // the applyEdit wrapper itself
    expect(card).toMatch(/const applyEdit = \(next: ClinicalExtraction\) => \{\s*setEdited\(true\);\s*edit\(next\);/);
  });

  it('re-record on an edited card asks before discarding', () => {
    expect(card).toMatch(/if \(edited && !confirmRerecord\)/);
    expect(card).toContain('Discard edits & re-record?');
  });
});
