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

describe('consult confirm — patient queries invalidate on CONFIRMED', () => {
  it('invalidates patient, plans, procedures, visits and teeth for the patient', () => {
    for (const key of ['patient', 'plans', 'completed-procedures', 'visits', 'teeth']) {
      expect(page, `missing invalidation of ['${key}', patientId]`).toContain(`['${key}', patientId]`);
    }
  });

  it('refreshes the queue snapshot the front desk watches', () => {
    expect(page).toMatch(/invalidateQueries\(\{ queryKey: \['queue'\] \}\)/);
  });

  it('invalidation happens on CONFIRMED, not on the way out of the screen', () => {
    // Originally this asserted invalidation ran BEFORE a router.replace, because the
    // screen auto-redirected to the patient record 1.8s after saving. Frame 31 gives that
    // screen two real actions, so the auto-redirect is gone (a screen that vanishes
    // mid-reach is worse than no buttons) — and with it the ordering this checked.
    //
    // The Issue 13 guarantee is unchanged and is what is asserted now: the caches are
    // invalidated the moment the record commits, so wherever the doctor goes next —
    // "Call next", "Back to Flow", or the patient record by hand — nothing serves the
    // pre-confirm "0 of 4 sittings" from the 30s staleTime.
    const confirmedBlock = page.slice(
      page.indexOf("state.kind === 'CONFIRMED'"),
      page.indexOf("state.kind === 'REJECTED'"),
    );
    expect(confirmedBlock).toContain('invalidateQueries');
    expect(confirmedBlock).not.toContain('setTimeout');
  });
});
