import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 2.6 §12.1: the Home dashboard must never carry a mascot (the giant
 * sleeping-tooth regression). Home empties use <EmptyState variant="inline" icon=…>.
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const home = readFileSync(join(webRoot, 'app', '(app)', 'home', 'page.tsx'), 'utf8');

describe('no mascot on Home', () => {
  it('does not import MascotMoment', () => {
    expect(home).not.toMatch(/MascotMoment/);
  });

  it('passes no `mascot=` prop to any component', () => {
    expect(home).not.toMatch(/mascot=/);
  });

  it('uses inline empty states instead', () => {
    expect(home).toMatch(/variant="inline"/);
  });
});
