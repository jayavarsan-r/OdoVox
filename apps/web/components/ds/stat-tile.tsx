"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * `.stat` — the v9 stat pill.
 *
 * Frame 56 is where the spec states the law this component enforces: "a lone number
 * never gets a bento tile — it gets a 46px stat pill". Tiles are reserved for content
 * with structure (money + breakdown, warnings, dates); a bare count gets a pill, which
 * frees ~90px of screen and reads faster.
 *
 * Spec: 46px tall, inline-flex, gap 9px, padding 0 15px, `shadow-stat` (which carries
 * the white top highlight). Value 19px/800 tabular-nums; label 10px/800 tracking .07em
 * pine-3. Tinted tones colour BOTH value and label.
 *
 * `shape="tile"` keeps the pre-migration stacked block for call sites that genuinely
 * want a grid cell rather than an inline pill.
 */
const statTile = cva("", {
  variants: {
    shape: {
      /* `.stat` — radius 17px sits between --radius-md (16) and --radius-lg (18);
         the spec is explicit about the value, so it is inlined here rather than
         inventing a token used exactly once. */
      pill: "inline-flex items-center gap-[9px] rounded-[17px] px-[15px] shadow-stat",
      tile: "flex flex-col rounded-xl border",
    },
    variant: {
      default: "",
      lime: "",
      sage: "",
      warning: "",
      crit: "",
      live: "",
    },
    size: { sm: "", md: "" },
  },
  compoundVariants: [
    /* pill tones — background only; text colour is applied to value + label below */
    { shape: "pill", variant: "default", class: "bg-surface" },
    { shape: "pill", variant: "lime", class: "bg-lime-soft" },
    { shape: "pill", variant: "sage", class: "bg-live-soft" },
    { shape: "pill", variant: "live", class: "bg-live-soft" },
    { shape: "pill", variant: "warning", class: "bg-warn-soft" },
    { shape: "pill", variant: "crit", class: "bg-crit-soft" },
    { shape: "pill", size: "sm", class: "h-[42px]" },
    { shape: "pill", size: "md", class: "h-[46px]" },

    /* legacy stacked tile */
    { shape: "tile", variant: "default", class: "border-hair bg-surface" },
    { shape: "tile", variant: "lime", class: "border-lime/40 bg-lime-soft" },
    { shape: "tile", variant: "sage", class: "border-live/30 bg-live-soft" },
    { shape: "tile", variant: "live", class: "border-live/30 bg-live-soft" },
    { shape: "tile", variant: "warning", class: "border-warn/40 bg-warn-soft" },
    { shape: "tile", variant: "crit", class: "border-crit/40 bg-crit-soft" },
    { shape: "tile", size: "sm", class: "p-3" },
    { shape: "tile", size: "md", class: "p-4" },
  ],
  /**
   * `tile` is the DEFAULT, not `pill`.
   *
   * Frame 56 makes the pill the target shape, but a pill is INLINE — it sizes to its
   * content. Defaulting to it silently reshaped the seven StatTiles already sitting in
   * /today's 4- and 3-column grids, and at 390px the cell is narrower than the pill's
   * content: "Collected" rendered as "Colle…", "Appointments" as "Appointm…". Clipped
   * labels are structural loss; the screenshot gate caught it at 6.5% on H1-today.
   *
   * Pages opt into `pill` as they adopt the spec's own layout (a bento pair plus a flex
   * stat row — never a 4-column grid). /today does that in Task 26.
   */
  defaultVariants: { shape: "tile", variant: "default", size: "md" },
});

/** Tinted tones colour the figure and its label; the default tone stays ink-on-white. */
const TONE_TEXT: Record<string, string> = {
  default: "text-pine",
  lime: "text-pine",
  sage: "text-live",
  live: "text-live",
  warning: "text-warn",
  crit: "text-crit",
};

const LABEL_TEXT: Record<string, string> = {
  default: "text-pine-3",
  lime: "text-pine-3",
  sage: "text-live",
  live: "text-live",
  warning: "text-warn",
  crit: "text-crit",
};

export interface StatTileProps extends VariantProps<typeof statTile> {
  value: string | number;
  label: string;
  className?: string;
}

export function StatTile({
  value,
  label,
  shape,
  variant,
  size,
  className,
}: StatTileProps) {
  const tone = variant ?? "default";
  const isPill = shape === "pill";

  // The legacy tile keeps its ORIGINAL typography (mono value, 650-weight label).
  // The spec's 800 weight belongs to the pill: at 800 the label is materially wider
  // per character, and inside /today's 4-column grid that clipped "Collected" to
  // "Collecte…". A shape change must not silently truncate a label.
  if (!isPill) {
    return (
      <div className={cn(statTile({ shape, variant, size }), className)}>
        <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight text-pine">
          {value}
        </p>
        <p className={cn("mt-0.5 text-xs font-medium", LABEL_TEXT[tone])}>
          {label}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(statTile({ shape, variant, size }), className)}>
      <b
        className={cn(
          "font-heavy leading-none tabular-nums",
          isPill ? "text-[19px]" : "font-mono text-2xl tracking-tight",
          TONE_TEXT[tone],
        )}
      >
        {value}
      </b>
      <span
        className={cn(
          "font-heavy",
          isPill ? "text-eyebrow tracking-[0.07em]" : "mt-0.5 text-3xs",
          LABEL_TEXT[tone],
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** Explicit alias — reads better at call sites that mean the pill (frames 56, 16, 43). */
export const StatPill = StatTile;
