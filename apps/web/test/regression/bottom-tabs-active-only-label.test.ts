import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { tabsForRole } from '../../lib/rbac';

/**
 * Locked design (§6 / §12.1): the lime pill shows ONLY on the active tab, with the
 * label next to its icon. Inactive tabs are icon-only and muted — their label stays
 * in the DOM as `sr-only` (acceptable per spec) but is never visible.
 *
 * vitest runs in a node env (no DOM — see vitest.config.ts), so we assert the data
 * (tabsForRole) and the render contract by reading the component source. The thing
 * we guard against is the Phase 2.6 regression where every tab rendered a visible
 * `{tab.label}` (stacked below the icon via flex-col).
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const tabsSrc = readFileSync(join(webRoot, 'components', 'app-shell', 'bottom-tabs.tsx'), 'utf8');

describe('bottom tabs — active-only label', () => {
  it('each role has exactly 5 tabs with the locked labels', () => {
    expect(tabsForRole('DOCTOR').map((t) => t.label)).toEqual([
      'Home',
      'Patients',
      'Schedule',
      'Lab',
      'Clinic',
    ]);
    expect(tabsForRole('RECEPTIONIST').map((t) => t.label)).toEqual([
      'Today',
      'Patients',
      'Schedule',
      'Lab',
      'Billing',
    ]);
  });

  it('with active="home" only the Home tab would surface a visible label', () => {
    // The visible label is gated behind `active` — exactly the active tab renders it.
    const doctor = tabsForRole('DOCTOR');
    const active = doctor.find((t) => t.href === '/home');
    expect(active?.label).toBe('Home');
    // The other four tabs are not the active one → their label is sr-only.
    expect(doctor.filter((t) => t.href !== '/home')).toHaveLength(4);
  });

  it('renders the visible label only inside the active branch (not unconditionally)', () => {
    // The Phase 2.6 regression rendered `{tab.label}` for every tab. The restored
    // design renders the visible label only within `active ? (...)`.
    expect(tabsSrc).toMatch(/active \? \(/);
    // The visible label lives in a motion.span that slides its width in.
    expect(tabsSrc).toMatch(/animate=\{\{ opacity: 1, width: 'auto' \}\}[\s\S]*?\{tab\.label\}/);
    // Inactive tabs keep the label only for screen readers.
    expect(tabsSrc).toMatch(/sr-only[^>]*>\{tab\.label\}/);
    // No stacked-below-icon layout (the regression used per-tab flex-col).
    expect(tabsSrc).not.toMatch(/flex-1 flex-col/);
  });

  it('puts the lime pill (icon + label) behind the active tab only', () => {
    expect(tabsSrc).toMatch(/layoutId="tab-pill"/);
    expect(tabsSrc).toMatch(/rounded-pill bg-lime/);
    // The active pill pads horizontally so the label sits next to the icon, not below.
    expect(tabsSrc).toMatch(/active \? 'gap-1\.5 px-3\.5' : 'w-10'/);
  });
});
