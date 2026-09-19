"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `.vrow` — the single most-repeated surface in v9. Patient rows, queue rows, lab
 * rows, bill rows, message rows, follow-ups: nearly every list frame is this.
 *
 * Spec: flex, gap 13px, padding 11px 18px. Adjacent rows are separated by a hairline
 * (`.vrow + .vrow { border-top }`), never by a gap — the card is one surface with rules
 * in it, which is why the rule is alpha-over-pine rather than a grey border.
 *
 * Name `.vr-name` 15.5/700 line-height 20px. Glyph strip `.vr-glyphs` gap 6px,
 * margin-top 5px, wraps — it holds <Mini> badges (tooth number, dues, ETA, state).
 *
 * Tappable rows obey the tap contract (frame 81): a row that names a thing opens that
 * thing. A row with no action gets no chevron.
 */
export interface ListRowProps {
  /** Avatar or icon at the leading edge. */
  leading?: React.ReactNode;
  title: React.ReactNode;
  /** The <Mini> strip under the title. */
  glyphs?: React.ReactNode;
  /** Amount, chevron, action chip, or status dot. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  /** Checked-out / completed rows render at 65% in the spec. */
  dimmed?: boolean;
  /** Crit rail for the "act now" state (overdue follow-ups, drug conflicts). */
  alert?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function ListRow({
  leading,
  title,
  glyphs,
  trailing,
  onClick,
  dimmed = false,
  alert = false,
  className,
  "aria-label": ariaLabel,
}: ListRowProps) {
  const content = (
    <>
      {leading}
      <span className="min-w-0 flex-1">
        <span className="block text-row font-semibold leading-5 text-pine">
          {title}
        </span>
        {glyphs ? (
          <span className="mt-[5px] flex flex-wrap items-center gap-1.5">
            {glyphs}
          </span>
        ) : null}
      </span>
      {trailing}
    </>
  );

  const classes = cn(
    "flex w-full items-center gap-[13px] px-[18px] py-[11px] text-left",
    "[&+&]:border-t [&+&]:border-hair",
    dimmed && "opacity-65",
    // Global Constraint 8: crit is a RAIL on the offending row, never a wash.
    alert && "shadow-[inset_3.5px_0_0_var(--crit)]",
    className,
  );

  if (!onClick) return <div className={classes}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={cn(
        classes,
        "min-h-target transition-colors duration-press active:bg-[rgba(31,42,35,0.03)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
      )}
    >
      {content}
    </button>
  );
}
