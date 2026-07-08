import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.6 Issue 13: after a confirm, the patient Overview showed a stale "0 of 4 sittings" —
 * the app's 30s staleTime meant the redirect happened before any refetch. The consult page must
 * invalidate every query the patient page reads (plus the queue snapshot) on CONFIRMED.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'app', '(app)', 'consult', '[id]', 'page.tsx'), 'utf8');

describe('consult confirm — patient queries invalidate before the redirect', () => {
  it('invalidates patient, plans, procedures, visits and teeth for the patient', () => {
    for (const key of ['patient', 'plans', 'completed-procedures', 'visits', 'teeth']) {
      expect(page, `missing invalidation of ['${key}', patientId]`).toContain(`['${key}', patientId]`);
    }
  });

  it('refreshes the queue snapshot the front desk watches', () => {
    expect(page).toMatch(/invalidateQueries\(\{ queryKey: \['queue'\] \}\)/);
  });

  it('invalidation happens on CONFIRMED, before the router.replace back to the patient', () => {
    const confirmedBlock = page.slice(page.indexOf("state.kind === 'CONFIRMED'"), page.indexOf("state.kind === 'REJECTED'"));
    expect(confirmedBlock).toContain('invalidateQueries');
    expect(confirmedBlock).toContain('router.replace');
    expect(confirmedBlock.indexOf('invalidateQueries')).toBeLessThan(confirmedBlock.indexOf('router.replace'));
  });
});
