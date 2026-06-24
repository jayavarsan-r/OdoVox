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
        'sage-tint': 'var(--color-sage-tint)',
        'sage-deep': 'var(--color-sage-deep)',
        lavender: 'var(--color-lavender)',
        'lavender-soft': 'var(--color-lavender-soft)',

        'paper-cream': 'var(--color-paper-cream)',
        'glass-light': 'var(--glass-bg-light)',
        'glass-dark': 'var(--glass-bg-dark)',
        'glass-lime': 'var(--glass-bg-lime)',
        'glass-sage': 'var(--glass-bg-sage)',

        text: 'var(--color-text)',
        'text-muted': 'var(--color-text-muted)',
        'text-subtle': 'var(--color-text-subtle)',
        surface: 'var(--color-surface)',
        'surface-raised': 'var(--color-surface-raised)',
        border: 'var(--color-border)',
        'border-strong': 'var(--color-border-strong)',
        success: 'var(--color-success)',
        warning: 'var(--color-warning)',
        'warning-soft': 'var(--color-warning-soft)',
        danger: 'var(--color-danger)',
        info: 'var(--color-info)',
        'info-soft': 'var(--color-info-soft)',
        'tool-patient': 'var(--color-tool-patient)',
        'tool-inventory': 'var(--color-tool-inventory)',
        'tool-lab': 'var(--color-tool-lab)',
        'tool-dayoff': 'var(--color-tool-dayoff)',
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
        'elev-0': 'var(--elev-0)',
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'elev-3': 'var(--elev-3)',
        'elev-4': 'var(--elev-4)',
        'elev-hero': 'var(--elev-hero)',
        'hero-dark': 'var(--elev-hero-dark)',
        'lime-glow': 'var(--elev-lime-glow)',
        'sage-glow': 'var(--elev-sage-glow)',
      },
      backdropBlur: {
        'glass-sm': 'var(--glass-blur-sm)',
        'glass-md': 'var(--glass-blur-md)',
        'glass-lg': 'var(--glass-blur-lg)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
      transitionTimingFunction: {
        spring: 'var(--ease-spring)',
        'spring-soft': 'var(--ease-spring-soft)',
        out: 'var(--ease-out)',
        in: 'var(--ease-in)',
      },
      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        base: 'var(--duration-base)',
        slow: 'var(--duration-slow)',
        emphatic: 'var(--duration-emphatic)',
      },
      maxWidth: {
        mobile: 'var(--max-width-mobile)',
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
