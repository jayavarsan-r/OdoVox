"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * `.set-row` — the settings list row. More hub, Account, WhatsApp, Availability,
 * Days off, and the consent gate all use it.
 *
 * Spec: flex, gap 12px, min-height 52px, padding 0 16px, hairline between rows.
 * Icon `.set-ic` 32px radius 11px (`--radius-xs`), tinted. Title `.set-t` 14.5/600
 * flex-1. Value `.set-v` 12.5/700 pine-3. Trailing chevron or a <Toggle>.
 *
 * A row with a Toggle is NOT a link — it must not also carry a chevron, or the user
 * cannot tell whether tapping navigates or switches.
 */
const settingIcon = cva(
  "flex size-8 shrink-0 items-center justify-center rounded-xs [&_svg]:size-[15px]",
  {
    variants: {
      tone: {
        neutral: "bg-[rgba(31,42,35,0.06)] text-pine-2",
        lime: "bg-lime-soft text-pine",
        sky: "bg-sky-soft text-sky",
        live: "bg-live-soft text-live",
        warn: "bg-warn-soft text-warn",
        crit: "bg-crit-soft text-crit",
        lav: "bg-lav-soft text-lav",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface SettingRowProps extends VariantProps<typeof settingIcon> {
  icon?: React.ReactNode;
  title: React.ReactNode;
  /** Right-aligned current value, e.g. "2 doctors", "₹620 / ₹1,000". */
  value?: React.ReactNode;
  /** A <Toggle>, a <Mini>, or a chevron. Mutually exclusive with `onClick`. */
  trailing?: React.ReactNode;
  onClick?: () => void;
  /** Destructive rows (Sign out) render their title in crit. */
  destructive?: boolean;
  className?: string;
}

export function SettingRow({
  icon,
  title,
  value,
  trailing,
  onClick,
  tone,
  destructive = false,
  className,
}: SettingRowProps) {
  const content = (
    <>
      {icon ? <span className={settingIcon({ tone })}>{icon}</span> : null}
      <span
        className={cn(
          "flex-1 text-left text-[14.5px] font-medium",
          destructive ? "text-crit" : "text-pine",
        )}
      >
        {title}
      </span>
      {value ? (
        <span className="text-xs font-semibold text-pine-3">{value}</span>
      ) : null}
      {trailing}
    </>
  );

  const classes = cn(
    "flex min-h-[52px] w-full items-center gap-3 px-4",
    "[&+&]:border-t [&+&]:border-hair",
    className,
  );

  if (!onClick) return <div className={classes}>{content}</div>;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        classes,
        "transition-colors duration-press active:bg-[rgba(31,42,35,0.03)]",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
      )}
    >
      {content}
    </button>
  );
}
