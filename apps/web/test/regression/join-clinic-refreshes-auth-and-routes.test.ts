import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Regression (Phase 9.5 P0.4) — the receptionist join-clinic loop. Two compounding bugs:
 *
 * 1. POST /clinics/join (and /clinics) mint a fresh access token carrying the new clinicId+role
 *    claims — the pages discarded it, so every clinic-scoped API call after joining 403'd on the
 *    stale claims-less token.
 * 2. `resetOnboarding()` clears `role` while the join page is still mounted; its
 *    `if (!role) router.replace('/role')` effect re-fired and stomped the /home navigation —
 *    bouncing the user back into onboarding, where a retry hit 409 ALREADY_IN_CLINIC.
 *
 * These are source-level assertions (the web vitest env is node-only, no DOM): they pin that the
 * pages adopt the returned token, route via landingRoute (receptionists land on /today, not
 * /home), and guard the role-redirect effect against the post-join reset.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const joinPage = readFileSync(join(webRoot, 'app', '(onboarding)', 'clinic-join', 'page.tsx'), 'utf8');
const createPage = readFileSync(
  join(webRoot, 'app', '(onboarding)', 'clinic-create', 'step-3-profile', 'page.tsx'),
  'utf8',
);

describe('clinic-join adopts the fresh session and routes by role', () => {
  it('reads accessToken off the join response and installs it', () => {
    expect(joinPage).toMatch(/accessToken: string/);
    expect(joinPage).toMatch(/setAccessToken\(\s*data\.accessToken\s*\)/);
  });

  it('routes via landingRoute(role), never hardcoded /home', () => {
    expect(joinPage).toMatch(/landingRoute\(/);
    expect(joinPage).not.toMatch(/replace\(['"]\/home['"]\)/);
  });

  it('guards the !role redirect so resetOnboarding cannot bounce a just-joined user', () => {
    expect(joinPage).toMatch(/joinedRef/);
    expect(joinPage).toMatch(/!role && !joinedRef\.current/);
  });
});

describe('clinic-create adopts the fresh session too', () => {
  it('reads accessToken off the create response and installs it', () => {
    expect(createPage).toMatch(/accessToken: string/);
    expect(createPage).toMatch(/setAccessToken\(\s*data\.accessToken\s*\)/);
  });
});
