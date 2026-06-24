import { describe, expect, it } from 'vitest';
import preset from '@odovox/ui/tailwind-preset';

/**
 * Token → Tailwind utility resolution. Guards that every Phase 2.5 design token
 * is exposed as a utility so `bg-sage-tint`, `shadow-elev-3`, `backdrop-blur-glass-md`
 * etc. actually compile. See docs/design-system.md §1–2.
 */
const theme = preset.theme!.extend!;

describe('color utilities', () => {
  const colors = theme.colors as Record<string, string>;

  it('exposes the clinical sage palette', () => {
    expect(colors.sage).toBe('var(--color-sage)');
    expect(colors['sage-soft']).toBe('var(--color-sage-soft)');
    expect(colors['sage-tint']).toBe('var(--color-sage-tint)');
    expect(colors['sage-deep']).toBe('var(--color-sage-deep)');
  });

  it('exposes paper-cream and glass background colors', () => {
    expect(colors['paper-cream']).toBe('var(--color-paper-cream)');
    expect(colors['glass-light']).toBe('var(--glass-bg-light)');
    expect(colors['glass-dark']).toBe('var(--glass-bg-dark)');
    expect(colors['glass-lime']).toBe('var(--glass-bg-lime)');
  });
});

describe('elevation + glow shadows', () => {
  const shadow = theme.boxShadow as Record<string, string>;

  it('exposes elev-1 through elev-4 and hero', () => {
    for (const k of ['elev-1', 'elev-2', 'elev-3', 'elev-4', 'elev-hero']) {
      expect(shadow[k]).toBe(`var(--${k})`);
    }
  });

  it('exposes lime + sage glows', () => {
    expect(shadow['lime-glow']).toBe('var(--elev-lime-glow)');
    expect(shadow['sage-glow']).toBe('var(--elev-sage-glow)');
  });
});

describe('glass blur + motion', () => {
  it('exposes backdrop-blur-glass utilities', () => {
    const blur = theme.backdropBlur as Record<string, string>;
    expect(blur['glass-sm']).toBe('var(--glass-blur-sm)');
    expect(blur['glass-md']).toBe('var(--glass-blur-md)');
    expect(blur['glass-lg']).toBe('var(--glass-blur-lg)');
  });

  it('exposes the new motion durations + easings', () => {
    const dur = theme.transitionDuration as Record<string, string>;
    expect(dur.instant).toBe('var(--duration-instant)');
    expect(dur.emphatic).toBe('var(--duration-emphatic)');
    const ease = theme.transitionTimingFunction as Record<string, string>;
    expect(ease['spring-soft']).toBe('var(--ease-spring-soft)');
    expect(ease.in).toBe('var(--ease-in)');
  });
});
