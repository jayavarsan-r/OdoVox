import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.6 Issue 9: teeth with an ACTIVE treatment plan must carry a visible marker on the
 * odontogram (sage dot), on BOTH the Overview mini-map and the full Tooth Map tab. The component
 * supported it; this pins that every render site actually passes activePlanTeeth.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const odontogram = readFileSync(join(webRoot, 'components', 'odontogram', 'odontogram.tsx'), 'utf8');
const patientPage = readFileSync(join(webRoot, 'app', '(app)', 'patients', '[id]', 'page.tsx'), 'utf8');

describe('tooth map — active plan highlighting', () => {
  it('the tooth renders a sage dot indicator when it belongs to an active plan', () => {
    expect(odontogram).toMatch(/hasPlan \?/);
    expect(odontogram).toMatch(/bg-sage/);
    expect(odontogram).toMatch(/aria-label=\{`Tooth \$\{n\}.*active plan.*`\}/);
  });

  it('every Odontogram on the patient page passes activePlanTeeth', () => {
    const renders = patientPage.match(/<Odontogram\b[^/]*?\/>/gs) ?? [];
    expect(renders.length).toBeGreaterThanOrEqual(2); // Overview mini-map + Tooth Map tab
    for (const r of renders) {
      expect(r, `an <Odontogram> render is missing activePlanTeeth:\n${r}`).toContain('activePlanTeeth');
    }
  });

  it('activePlanTeeth is derived from ACTIVE plans only', () => {
    expect(patientPage).toMatch(/filter\(\(p\) => p\.status === 'ACTIVE'\)/);
  });
});
