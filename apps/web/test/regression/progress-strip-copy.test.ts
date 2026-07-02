import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Regression (Phase 9.5 P1.7, Issue 5): the pipeline strip read like a machine console —
 * "Transcribing (Sarvam · saarika:v2.5)", "Understanding (Gemini Flash)" — and the recorder CTA
 * said "Send for review". Users get friendly language; provider brand names never render.
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const strip = readFileSync(join(webRoot, 'components', 'voice', 'progress-strip.tsx'), 'utf8');
const recorder = readFileSync(join(webRoot, 'components', 'voice', 'recorder.tsx'), 'utf8');

describe('progress strip copy', () => {
  it('uses friendly step labels', () => {
    expect(strip).toMatch(/'Sent'/);
    expect(strip).toMatch(/'Listening…'/);
    expect(strip).toMatch(/'Making sense of it…'/);
  });

  it('never shows provider brand names', () => {
    for (const source of [strip, recorder]) {
      expect(source).not.toMatch(/Sarvam|saarika|Gemini/i);
    }
  });
});

describe('recorder CTA copy', () => {
  it('says "Save findings", not "Send for review"', () => {
    expect(recorder).toMatch(/Save findings/);
    expect(recorder).not.toMatch(/Send for review/);
  });
});
