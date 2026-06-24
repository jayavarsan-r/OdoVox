import { describe, expect, it } from 'vitest';
import { canAccess, tabsForRole, landingRoute } from './rbac';

describe('rbac', () => {
  it('gives doctors and receptionists different 5-tab sets', () => {
    const doc = tabsForRole('DOCTOR').map((t) => t.href);
    const rec = tabsForRole('RECEPTIONIST').map((t) => t.href);
    expect(doc).toContain('/home');
    expect(doc).not.toContain('/today');
    expect(rec).toContain('/today');
    expect(rec).toContain('/billing');
    expect(rec).not.toContain('/home');
    expect(doc).toHaveLength(5);
    expect(rec).toHaveLength(5);
  });

  it('lands each role on the right home', () => {
    expect(landingRoute('DOCTOR')).toBe('/home');
    expect(landingRoute('RECEPTIONIST')).toBe('/today');
  });

  it('blocks receptionist from /home and doctor from /today and /billing', () => {
    expect(canAccess('/home', 'RECEPTIONIST')).toBe(false);
    expect(canAccess('/today', 'DOCTOR')).toBe(false);
    expect(canAccess('/billing', 'DOCTOR')).toBe(false);
  });

  it('shares patients/schedule/lab across roles (incl. nested patient routes)', () => {
    expect(canAccess('/patients', 'RECEPTIONIST')).toBe(true);
    expect(canAccess('/patients/abc123', 'RECEPTIONIST')).toBe(true);
    expect(canAccess('/schedule', 'DOCTOR')).toBe(true);
    expect(canAccess('/lab', 'RECEPTIONIST')).toBe(true);
  });
});
