import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * `.bt` — the v9 bento tile. For structured content: two or more related facts, an
 * icon, a trend. A lone number belongs in `StatPill` instead — Global Constraint 9:
 * "a lone number never gets a bento tile, it gets a pill." These two components
 * together are what make that law enforceable.
 *
 * Spec (odovox-v9-master.html `.bt`/`.bl`/`.bv`, confirmed against source): white,
 * radius `--radius-2xl` (24px), padding 16px, `shadow-tile`. Unlike `.stat`/`.qt`/
 * `.dpill`, `.bt`'s box-shadow is a single layer with no `--highlight-top` inset —
 * that omission is in the source spec itself (`.bt{...box-shadow:0 8px 20px
 * rgba(31,42,35,.06)...}`, no second layer), not an oversight here.
 * Label `.bl`: 10px/800, tracking `--tracking-bento-label` (.08em), pine-3.
 * Value `.bv`: 23px/800, tracking -.02em, tabular-nums, 3px below the label.
 * Tinted tones (sky/crit/live/warn) colour both label and value to the tone's
 * saturated foreground. `lime` never tints its text — confirmed by source, every
 * `.bt.limes` instance in the spec leaves label/value at the default ink colour,
 * because `--lime` itself is too pale to read as text (the same rule IconCircle and
 * Badge already follow for their own lime tones).
 */
const bentoTile = cva("relative overflow-hidden rounded-2xl p-4 shadow-tile", {
  variants: {
    tone: {
      neutral: "bg-surface",
      lime: "bg-tile-lime",
      sky: "bg-sky-soft",
      crit: "bg-crit-soft",
      live: "bg-live-soft",
      warn: "bg-warn-soft",
    },
  },
  defaultVariants: { tone: "neutral" },
});

export type BentoTileTone = NonNullable<VariantProps<typeof bentoTile>["tone"]>;

const labelTone: Record<BentoTileTone, string> = {
  neutral: "text-pine-3",
  lime: "text-pine-3",
  sky: "text-sky",
  crit: "text-crit",
  live: "text-live",
  warn: "text-warn",
};

const valueTone: Record<BentoTileTone, string> = {
  neutral: "text-pine",
  lime: "text-pine",
  sky: "text-sky",
  crit: "text-crit",
  live: "text-live",
  warn: "text-warn",
};

export interface BentoTileProps extends VariantProps<typeof bentoTile> {
  label?: string;
  value?: string | number;
  /** Grid columns to span in the parent's bento grid (`.bt.w2`). Default 1 — the
   *  parent grid must actually be a 2-column grid for this to have any effect. */
  span?: 1 | 2;
  className?: string;
  /** Escape hatch for tiles whose content is richer than a label/value pair (an
   *  icon, a badge, a bigger figure) — later tasks (More hub, verification bento)
   *  need this. Renders after label/value, inside the same tile surface. */
  children?: React.ReactNode;
}

export function BentoTile({
  tone,
  label,
  value,
  span = 1,
  className,
  children,
}: BentoTileProps) {
  const t: BentoTileTone = tone ?? "neutral";
  return (
    <div
      className={cn(bentoTile({ tone }), span === 2 && "col-span-2", className)}
    >
      {label !== undefined ? (
        <div
          className={cn(
            "text-eyebrow font-heavy tracking-bento-label",
            labelTone[t],
          )}
        >
          {label}
        </div>
      ) : null}
      {value !== undefined ? (
        <div
          className={cn(
            "mt-[3px] text-[23px] font-heavy leading-none tracking-tight tabular-nums",
            valueTone[t],
          )}
        >
          {value}
        </div>
      ) : null}
      {children}
    </div>
  );
}
