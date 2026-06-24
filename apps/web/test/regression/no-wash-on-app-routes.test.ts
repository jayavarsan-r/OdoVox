import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 2.6 §12.1: <GradientMesh> is banned on every (app)/* route — the wash
 * regression. Walk every page/layout under app/(app) and assert it never imports
 * or renders GradientMesh.
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const appDir = join(webRoot, 'app', '(app)');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.tsx')) out.push(full);
  }
  return out;
}

const files = walk(appDir);

describe('no GradientMesh on (app)/* routes', () => {
  it('actually found app route files to scan', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  for (const file of files) {
    const rel = file.slice(webRoot.length + 1);
    it(`${rel} has no GradientMesh`, () => {
      expect(readFileSync(file, 'utf8')).not.toMatch(/GradientMesh/);
    });
  }
});
