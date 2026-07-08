import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.6 Issue 14: receptionists must never see the "Record findings" surface — dictating
 * clinical findings is a doctor act (regulatory). The server already 403s POST /consultations for
 * receptionists (create-consultation-rbac-doctor-only.test.ts in apps/api); this pins the client
 * half so the card can't silently reappear for the wrong role.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const page = readFileSync(join(webRoot, 'app', '(app)', 'patients', '[id]', 'page.tsx'), 'utf8');

describe('patient detail — record findings is role-gated', () => {
  it('derives a doctor-only flag from the active membership role', () => {
    expect(page).toMatch(/useAuth\(\(s\) => s\.activeMembership\?\.role\)/);
    expect(page).toMatch(/canRecordFindings = role === 'DOCTOR' \|\| role === 'ADMIN'/);
  });

  it('renders the "Record findings" hero only behind the doctor gate', () => {
    // The hero must sit inside a canRecordFindings conditional, not render unconditionally.
    const heroIdx = page.indexOf('title="Record findings"');
    expect(heroIdx).toBeGreaterThan(-1);
    const before = page.slice(Math.max(0, heroIdx - 300), heroIdx);
    expect(before).toMatch(/canRecordFindings \? \(/);
  });

  it('gates the "Continue treatment" recorder button the same way', () => {
    const btnIdx = page.indexOf('Continue treatment');
    expect(btnIdx).toBeGreaterThan(-1);
    const before = page.slice(Math.max(0, btnIdx - 400), btnIdx);
    expect(before).toMatch(/canRecordFindings \? \(/);
  });
});
