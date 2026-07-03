import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.7 §3.4 — every (app)/* route is wrapped by a friendly error boundary with retry.
 * Next.js applies app/(app)/error.tsx to the whole segment, so one file covers every screen.
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('route error boundary', () => {
  it('(app)/error.tsx exists, is a client component, and offers one-tap retry', () => {
    const src = readFileSync(join(webRoot, 'app', '(app)', 'error.tsx'), 'utf8');
    expect(src).toContain("'use client'");
    expect(src).toMatch(/reset\(\)/); // Next resets the segment — retry in place
    expect(src).toContain('Try again');
    expect(src).not.toMatch(/lorem|TODO/i);
  });
});
