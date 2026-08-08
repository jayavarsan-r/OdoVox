"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * `.qt` — the Home quick-tool tile (frames 13, 15).
 *
 * Spec: white, radius 22px (`--radius-xl`), padding 12px 13px, `shadow-quick-tile`,
 * flex ROW (not a column — the icon sits beside the text, which is what lets four
 * tools fit above the fold), gap 11px, min-height 68px.
 * Icon block `.qi` 40px radius 14px, tinted background + saturated icon.
 * Title 15/800 tracking -.015em. Subtitle 11.5/650 pine-2 line-height 1.35.
 * Optional badge pinned top-right (`.bdg`).
 *
 * `wide` spans both columns at min-height 58px, radius 19px, on the warm gradient —
 * the spec uses it for the Block time · Day off bar, which is a state, not a creation,
 * and so is deliberately shaped differently from the four tools above it.
 */
const quickTile = cva(
  [
    "relative flex w-full items-center gap-[11px] text-left",
    "transition-all duration-press active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
  ].join(" "),
  {
    variants: {
      wide: {
        false:
          "min-h-[68px] rounded-xl bg-surface px-[13px] py-3 shadow-quick-tile",
        true: "col-span-2 min-h-[58px] rounded-[19px] bg-tile-warn px-[13px] py-3 shadow-quick-tile",
      },
    },
    defaultVariants: { wide: false },
  },
);

const quickIcon = cva(
  "flex size-10 shrink-0 items-center justify-center rounded-sm [&_svg]:size-[18px]",
  {
    variants: {
      tone: {
        lime: "bg-lime-soft text-pine",
        sky: "bg-sky-soft text-sky",
        live: "bg-live-soft text-live",
        warn: "bg-warn-soft text-warn",
        lav: "bg-lav-soft text-lav",
        crit: "bg-crit-soft text-crit",
        /* `.qt.wide .qi` is white on the gradient, with its own warm-tinted shadow. */
        onWarm: "bg-white text-warn shadow-[0_3px_8px_rgba(185,106,37,0.14)]",
      },
    },
    defaultVariants: { tone: "lime" },
  },
);

export interface QuickTileProps extends VariantProps<typeof quickTile> {
  icon: React.ReactNode;
  iconTone?: VariantProps<typeof quickIcon>["tone"];
  label: string;
  /** The line that changes with the day ("Meena's crown late", "8 today · lunch 13:00"). */
  subtitle?: string;
  /** Count or state marker, pinned top-right. */
  badge?: React.ReactNode;
  /** Chevron for the wide bar. */
  trailing?: React.ReactNode;
  onClick: () => void;
  className?: string;
}

export function QuickTile({
  icon,
  iconTone,
  label,
  subtitle,
  badge,
  trailing,
  wide,
  onClick,
  className,
}: QuickTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(quickTile({ wide }), className)}
    >
      <span
        className={quickIcon({ tone: iconTone ?? (wide ? "onWarm" : "lime") })}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-md font-heavy leading-[1.1] tracking-[-0.015em] text-pine">
          {label}
        </span>
        {subtitle ? (
          <span className="mt-[3px] block text-2xs font-medium leading-[1.35] text-pine-2">
            {subtitle}
          </span>
        ) : null}
      </span>
      {trailing}
      {badge ? (
        <span className="absolute right-[11px] top-[9px]">{badge}</span>
      ) : null}
    </button>
  );
}
