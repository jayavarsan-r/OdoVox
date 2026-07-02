import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

/**
 * Phase 9.7 W1.1 — voice everywhere follows ONE shared pattern: the scattered per-surface mic
 * buttons are migrated to <VoiceInput>. This guards against a surface quietly reverting to a
 * hand-rolled useDictation + <Mic> button (the pre-9.7 state).
 */

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (...p: string[]) => readFileSync(join(webRoot, ...p), 'utf8');

const MIGRATED_SURFACES = [
  ['components', 'voice-search-input.tsx'], // patient search mic (Phase 3)
  ['components', 'queue', 'walk-in-sheet.tsx'], // voice walk-in (Phase 9.5)
  ['components', 'queue', 'checkout-sheet.tsx'], // checkout notes (Phase 9.5)
  ['app', '(app)', 'patients', 'new', 'page.tsx'], // intake dictation (Phase 3)
  ['app', '(app)', 'patients', '[id]', 'page.tsx'], // prescription dictation (Phase 3)
];

describe('<VoiceInput> — the one shared voice control', () => {
  it('every migrated surface renders <VoiceInput>, none hand-roll useDictation', () => {
    for (const path of MIGRATED_SURFACES) {
      const src = read(...path);
      expect(src, path.join('/')).toContain('VoiceInput');
      expect(src, `${path.join('/')} must not import useDictation directly`).not.toContain(
        "from '@/lib/voice/use-dictation'",
      );
    }
  });

  it('supports the three modes and the 60s safety cap', () => {
    const component = read('components', 'voice', 'voice-input.tsx');
    const logic = read('lib', 'voice', 'voice-input.ts');
    expect(logic).toContain("'single-shot' | 'extraction' | 'notes'");
    expect(logic).toContain('MAX_DICTATION_MS = 60_000');
    expect(component).toContain('MAX_DICTATION_MS');
    // Cancel affordance is visible while recording; friendly copy comes from voiceStatusCopy.
    expect(component).toContain('Cancel');
    expect(logic).toContain('Listening…');
    expect(logic).toContain('Making sense of it…');
  });

  it('home renders the voice command hero wired to the intent router', () => {
    const home = read('app', '(app)', 'home', 'page.tsx');
    expect(home).toContain('VoiceCommandHero');
    const hero = read('components', 'voice', 'voice-command-hero.tsx');
    expect(hero).toContain('routeVoiceCommand');
    expect(hero).toContain('Speak to Odovox');
  });
});
