import type { Config } from 'tailwindcss';

/**
 * Shared Tailwind preset that maps Odovox CSS-variable tokens (see tokens.css)
 * onto utility classes (`bg-ink`, `text-text-muted`, `rounded-lg`, `shadow-card`, …).
 * Apps reference this via `@config` / `presets` so every app shares one scale.
 */
const preset = {
  theme: {
    extend: {
      colors: {
        ink: 'var(--color-ink)',
        'ink-soft': 'var(--color-ink-soft)',
        paper: 'var(--color-paper)',
        'paper-warm': 'var(--color-paper-warm)',

        lime: 'var(--color-lime)',
        'lime-soft': 'var(--color-lime-soft)',
        peach: 'var(--color-peach)',
        'peach-soft': 'var(--color-peach-soft)',
        sky: 'var(--color-sky)',
        'sky-soft': 'var(--color-sky-soft)',
        sage: 'var(--color-sage)',
        'sage-soft': 'var(--color-sage-soft)',
        lavender: 'var(--color-lavender)',
        'lavender-soft': 'var(--color-lavender-soft)',

        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'text-subtle': 'var(--color-text-subtle)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        card: 'var(--shadow-card)',
        hero: 'var(--shadow-hero)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
      transitionTimingFunction: {
        spring: 'var(--ease-spring)',
        out: 'var(--ease-out)',
      },
      transitionDuration: {
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
      },
      maxWidth: {
        mobile: 'var(--max-width-mobile)',
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
