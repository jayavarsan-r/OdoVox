import type { Config } from "tailwindcss";

/**
 * Shared Tailwind preset that maps Odovox CSS-variable tokens (see tokens.css)
 * onto utility classes (`bg-pine`, `text-pine-2`, `rounded-3xl`, `shadow-card`, …).
 * Apps reference this via `@config` / `presets` so every app shares one scale.
 *
 * Phase 10: the v9 canonical names (pine / sky / live / warn / lav / crit / hair) are
 * added alongside the existing ones. Legacy pastel names keep working until each page
 * stage migrates its own call sites — see docs/migration/03-visual-migration-plan.md §2.1.
 */
const preset = {
  theme: {
    extend: {
      colors: {
        /* --- v9 canonical ------------------------------------------------ */
        pine: "var(--pine)",
        "pine-2": "var(--pine-2)",
        "pine-3": "var(--pine-3)",
        canvas: "var(--canvas)",
        /* `card` is intentionally NOT aliased here — apps/web/tailwind.config.ts owns
           it for shadcn (card.DEFAULT / card.foreground). Use `surface` instead. */
        sheet: "var(--sheet)",

        lime: "var(--lime)",
        "lime-soft": "var(--lime-soft)",
        "lime-press": "var(--lime-press)",

        sky: "var(--sky)",
        "sky-soft": "var(--sky-soft)",
        live: "var(--live)",
        "live-soft": "var(--live-soft)",
        warn: "var(--warn)",
        "warn-soft": "var(--warn-soft)",
        lav: "var(--lav)",
        "lav-soft": "var(--lav-soft)",
        crit: "var(--crit)",
        "crit-soft": "var(--crit-soft)",

        hair: "var(--hair)",
        "hair-2": "var(--hair-2)",

        /* --- existing names (retuned or unchanged in tokens.css) --------- */
        ink: "var(--color-ink)",
        "ink-soft": "var(--color-ink-soft)",
        paper: "var(--color-paper)",
        "paper-warm": "var(--color-paper-warm)",
        "paper-cream": "var(--color-paper-cream)",

        peach: "var(--color-peach)",
        "peach-soft": "var(--color-peach-soft)",
        sage: "var(--color-sage)",
        "sage-soft": "var(--color-sage-soft)",
        "sage-tint": "var(--color-sage-tint)",
        "sage-deep": "var(--color-sage-deep)",
        lavender: "var(--color-lavender)",
        "lavender-soft": "var(--color-lavender-soft)",

        "glass-light": "var(--glass-bg-light)",
        "glass-dark": "var(--glass-bg-dark)",
        "glass-lime": "var(--glass-bg-lime)",
        "glass-sage": "var(--glass-bg-sage)",
        "glass-menu": "var(--glass-menu)",

        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        "text-subtle": "var(--color-text-subtle)",
        surface: "var(--color-surface)",
        "surface-raised": "var(--color-surface-raised)",
        border: "var(--color-border)",
        "border-strong": "var(--color-border-strong)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        "warning-soft": "var(--color-warning-soft)",
        danger: "var(--color-danger)",
        info: "var(--color-info)",
        "info-soft": "var(--color-info-soft)",
        "tool-patient": "var(--color-tool-patient)",
        "tool-inventory": "var(--color-tool-inventory)",
        "tool-lab": "var(--color-tool-lab)",
        "tool-dayoff": "var(--color-tool-dayoff)",
      },
      borderRadius: {
        "2xs": "var(--radius-2xs)",
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        nav: "var(--radius-nav)",
        pill: "var(--radius-pill)",
      },
      boxShadow: {
        /* composed surface shadows — each carries its top highlight */
        card: "var(--shadow-card)",
        tile: "var(--shadow-tile)",
        "quick-tile": "var(--shadow-quick-tile)",
        stat: "var(--shadow-stat)",
        icirc: "var(--shadow-icirc)",
        cta: "var(--shadow-cta)",
        orb: "var(--shadow-orb)",
        nav: "var(--shadow-nav)",
        sheetShadow: "var(--shadow-sheet)",
        toast: "var(--shadow-toast)",
        drag: "var(--shadow-drag)",

        /* avatar status rings */
        "ring-lime": "var(--ring-avatar-lime)",
        "ring-live": "var(--ring-avatar-live)",
        "ring-sky": "var(--ring-avatar-sky)",
        "ring-none": "var(--ring-avatar-none)",

        /* neutral ladder */
        soft: "var(--shadow-soft)",
        hero: "var(--shadow-hero)",
        "elev-0": "var(--elev-0)",
        "elev-1": "var(--elev-1)",
        "elev-2": "var(--elev-2)",
        "elev-3": "var(--elev-3)",
        "elev-4": "var(--elev-4)",
        "elev-hero": "var(--elev-hero)",
        "hero-dark": "var(--elev-hero-dark)",
        "lime-glow": "var(--elev-lime-glow)",
        "sage-glow": "var(--elev-sage-glow)",
        "highlight-top": "var(--highlight-top)",
      },
      backdropBlur: {
        "glass-sm": "var(--glass-blur-sm)",
        "glass-md": "var(--glass-blur-md)",
        "glass-lg": "var(--glass-blur-lg)",
        nav: "var(--blur-nav)",
        menu: "var(--blur-menu)",
      },
      backgroundImage: {
        amb: "var(--amb)",
        "hero-c": "var(--grad-hero-c)",
        orb: "var(--grad-orb)",
        "tile-lime": "var(--grad-tile-lime)",
        "tile-warn": "var(--grad-tile-warn)",
        "nav-sheen": "var(--grad-nav-sheen)",
        "wash-lime": "var(--wash-lime-corner)",
        "hatch-lunch": "var(--hatch-lunch)",
        "hatch-off": "var(--hatch-off)",
        "hero-dark": "var(--hero-dark-grad)",
      },
      fontFamily: {
        display: "var(--font-display)",
        mono: "var(--font-mono)",
      },
      fontSize: {
        tiny: "var(--text-tiny)",
        label: "var(--text-label)",
        eyebrow: "var(--text-eyebrow)",
        micro: "var(--text-micro)",
        "3xs": "var(--text-3xs)",
        "2xs": "var(--text-2xs)",
        xs: "var(--text-xs)",
        body: "var(--text-body)",
        sm: "var(--text-sm)",
        md: "var(--text-md)",
        row: "var(--text-row)",
        base: "var(--text-base)",
        lg: "var(--text-lg)",
        "sheet-title": "var(--text-sheet-title)",
        h3: "var(--text-h3)",
        h2: "var(--text-h2)",
        question: "var(--text-question)",
        h1: "var(--text-h1)",
        display: "var(--text-display)",
      },
      fontWeight: {
        regular: "var(--weight-regular)",
        medium: "var(--weight-medium)",
        semibold: "var(--weight-semibold)",
        bold: "var(--weight-bold)",
        heavy: "var(--weight-heavy)",
      },
      letterSpacing: {
        display: "var(--tracking-display)",
        tight: "var(--tracking-tight)",
        snug: "var(--tracking-snug)",
        label: "var(--tracking-label)",
        "bento-label": "var(--tracking-bento-label)",
        eyebrow: "var(--tracking-eyebrow)",
        logo: "var(--tracking-logo)",
      },
      transitionTimingFunction: {
        spring: "var(--ease-spring)",
        "spring-soft": "var(--ease-spring-soft)",
        out: "var(--ease-out)",
        in: "var(--ease-in)",
      },
      transitionDuration: {
        press: "var(--duration-press)",
        state: "var(--duration-state)",
        instant: "var(--duration-instant)",
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
        emphatic: "var(--duration-emphatic)",
      },
      spacing: {
        gutter: "var(--gutter)",
        "gutter-wide": "var(--gutter-wide)",
        "gutter-onboarding": "var(--gutter-onboarding)",
        "pad-card": "var(--pad-card)",
        "pad-tile": "var(--pad-tile)",
        "gap-tight": "var(--gap-tight)",
        "gap-card": "var(--gap-card)",
        "gap-row": "var(--gap-row)",
        target: "var(--target-min)",
        cta: "var(--target-cta)",
        orb: "var(--target-orb)",
        nav: "var(--target-nav)",
        "nav-capsule": "var(--target-nav-capsule)",
      },
      maxWidth: {
        mobile: "var(--max-width-mobile)",
      },
    },
  },
} satisfies Partial<Config>;

export default preset;
