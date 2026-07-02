import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { consultHeroSubtitle } from './home-summary.js';

/**
 * Regression (Phase 9.5 P1.1, Issue 2): the doctor Home hero said "Queue is clear" — hardcoded —
 * while patients sat in the queue on /consult. The subtitle must derive from the SAME queue store
 * the consult page reads (hydrated by useQueueSnapshot, kept live by queue.* realtime events).
 */

describe('consultHeroSubtitle', () => {
  it('empty queue → "Queue is clear"', () => {
    expect(consultHeroSubtitle(null, 0)).toBe('Queue is clear');
  });

  it('waiting only → count', () => {
    expect(consultHeroSubtitle(null, 1)).toBe('1 waiting');
    expect(consultHeroSubtitle(null, 3)).toBe('3 waiting');
  });

  it('in chair → name, with waiting count when present', () => {
    expect(consultHeroSubtitle('Akhilesh', 0)).toBe('Now treating Akhilesh');
    expect(consultHeroSubtitle('Akhilesh', 2)).toBe('Now treating Akhilesh · 2 waiting');
  });
});

describe('Home hero wiring', () => {
  const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const home = readFileSync(join(webRoot, 'app', '(app)', 'home', 'page.tsx'), 'utf8');

  it('no longer hardcodes the subtitle; reads the shared queue store', () => {
    expect(home).not.toMatch(/subtitle="Queue is clear"/);
    expect(home).toMatch(/useQueueSnapshot\('me'\)/);
    expect(home).toMatch(/consultHeroSubtitle\(/);
  });
});
