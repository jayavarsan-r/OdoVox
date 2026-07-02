import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Regression (Phase 9.5 P1.4, Issue 8): the Cases tab must render an ACTIVE TREATMENT section
 * above PAST TREATMENTS (Phase 5 §3.1) — with a progress bar and a next-sitting hint — and a
 * DRAFT plan must never be bucketed under "past". (The user's screenshot showing no active
 * section was data starvation from the P0.2 confirm crash, but these buckets also mis-filed
 * DRAFT plans.)
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'app', '(app)', 'patients', '[id]', 'page.tsx'), 'utf8');

describe('Cases tab — active treatment section', () => {
  it('renders Active treatment above Past treatments', () => {
    const active = page.indexOf('Active treatment');
    const past = page.indexOf('Past treatments');
    expect(active).toBeGreaterThan(-1);
    expect(past).toBeGreaterThan(active);
  });

  it('treats DRAFT as active/not-started, never past', () => {
    expect(page).toMatch(/status === 'ACTIVE' \|\| p\.status === 'DRAFT'/);
    expect(page).toMatch(/status !== 'ACTIVE' && p\.status !== 'DRAFT'/);
  });

  it('active card carries a next-sitting hint', () => {
    expect(page).toMatch(/Next: sitting/);
  });
});
