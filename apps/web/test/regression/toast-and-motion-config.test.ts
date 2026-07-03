import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/** Phase 9.7 §3.3/§3.4 cross-cutting: toast discipline + reduced-motion respect, set app-wide. */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const providers = readFileSync(join(webRoot, 'app', 'providers.tsx'), 'utf8');

describe('toast configuration', () => {
  it('bottom of screen, 3s auto-dismiss, ONE at a time, safe-area aware', () => {
    expect(providers).toContain('position="bottom-center"');
    expect(providers).toContain('visibleToasts={1}');
    expect(providers).toContain('duration: 3000');
    expect(providers).toContain('safe-area-inset-bottom');
  });
});

describe('motion respects prefers-reduced-motion', () => {
  it('MotionConfig reducedMotion="user" wraps the app', () => {
    expect(providers).toContain('MotionConfig');
    expect(providers).toContain('reducedMotion="user"');
  });
});

describe('skeletons during load (priority screens)', () => {
  it('priority screens render skeletons, not blank screens or spinners-as-pages', () => {
    for (const path of [
      ['app', '(app)', 'home', 'page.tsx'],
      ['app', '(app)', 'inventory', 'page.tsx'],
      ['app', '(app)', 'lab', '[caseId]', 'page.tsx'],
      ['app', '(app)', 'messages', 'lab', 'page.tsx'],
      ['app', '(app)', 'schedule', 'page.tsx'],
    ]) {
      const src = readFileSync(join(webRoot, ...path), 'utf8');
      expect(src, path.join('/')).toMatch(/Skeleton|ListSkeleton/);
    }
  });
});
