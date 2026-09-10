"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `.sec` — the section title strip above every list in v9.
 *
 * Spec: flex, space-between, padding 20px 20px 9px. Title `.sec-t` 14/800.
 * Action `.sec-a` 13/700 pine-3 — often a count ("Queue · 3"), sometimes a link
 * ("View all · 3"), sometimes a state ("1 conflict" in crit, "✓ checked" in live).
 *
 * When the action is a link it must go somewhere real (frame 81): "View all" that
 * leads nowhere is a dead end.
 */
export interface SectionHeaderProps {
  title: React.ReactNode;
  /** Count, link label, or state text. */
  action?: React.ReactNode;
  onAction?: () => void;
  /** State colour for the action slot — crit for conflicts, live for all-clear. */
  actionTone?: "muted" | "crit" | "live" | "sky";
  className?: string;
}

const ACTION_TONE = {
  muted: "text-pine-3",
  crit: "text-crit",
  live: "text-live",
  sky: "text-sky",
} as const;

export function SectionHeader({
  title,
  action,
  onAction,
  actionTone = "muted",
  className,
}: SectionHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-5 pb-[9px] pt-5",
        className,
      )}
    >
      <h2 className="text-sm font-heavy text-pine">{title}</h2>
      {action ? (
        onAction ? (
          <button
            type="button"
            onClick={onAction}
            className={cn(
              "min-h-target text-body font-semibold transition-colors duration-press",
              "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
              ACTION_TONE[actionTone],
            )}
          >
            {action}
          </button>
        ) : (
          <span
            className={cn("text-body font-semibold", ACTION_TONE[actionTone])}
          >
            {action}
          </span>
        )
      ) : null}
    </div>
  );
}
