import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 2.6 §12.1: no emoji in headings/copy ("Your clinic is live" — no 🎉).
 * Emoji-only emphasis is banned; mascots + SVGs carry visual weight.
 * NOTE: the arrow block (U+2190–U+21FF, e.g. "→") is intentionally excluded — it's
 * used in section links and is not an emoji.
 */
const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{1F1E6}-\u{1F1FF}]/u;

const PAGES: Record<string, string> = {
  '/done': join(webRoot, 'app', '(onboarding)', 'done', 'page.tsx'),
  '/home': join(webRoot, 'app', '(app)', 'home', 'page.tsx'),
  '/patients': join(webRoot, 'app', '(app)', 'patients', 'page.tsx'),
};

describe('headings contain no emoji', () => {
  for (const [route, file] of Object.entries(PAGES)) {
    it(`${route} page has no emoji characters`, () => {
      const src = readFileSync(file, 'utf8');
      const match = src.match(EMOJI);
      expect(match, match ? `found emoji: ${match[0]}` : '').toBeNull();
    });
  }
});
