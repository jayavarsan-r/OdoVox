import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.6 Issue 15 (safety hatch): the queue step must never trap the receptionist — "Skip,
 * add later" closes the sheet and lands on the new patient's detail page instead.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'app', '(app)', 'patients', 'new', 'page.tsx'), 'utf8');
const sheet = readFileSync(join(webRoot, 'components', 'queue', 'add-to-queue-sheet.tsx'), 'utf8');

describe('new patient → skip queue stays optional', () => {
  it('the sheet always renders a skip action', () => {
    expect(sheet).toContain('Skip, add later');
    expect(sheet).toMatch(/onClick=\{\(\) => onDone\(false\)\}/);
  });

  it('skipping routes to the created patient detail page', () => {
    expect(page).toMatch(/id \? `\/patients\/\$\{id\}` : '\/patients'/);
  });

  it('doctors keep the direct redirect (no forced queue step)', () => {
    expect(page).toMatch(/router\.replace\(`\/patients\/\$\{patient\.id\}`\)/);
  });
});
