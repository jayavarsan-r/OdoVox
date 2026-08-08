"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `.tg` — the spec's switch. Settings rows, consent gates, WhatsApp automations.
 *
 * Spec: 46×28 track, radius 15; 22×22 white knob inset 3px with
 * `0 2px 5px rgba(31,42,35,.2)`; track goes lime when on.
 * Pressed state stretches the knob 2px (v9 active-state matrix).
 */
export interface ToggleProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  /** Accessible name. Omit only when a visible <label> already names it. */
  label?: string;
  id?: string;
  className?: string;
}

export function Toggle({
  checked,
  onCheckedChange,
  disabled = false,
  label,
  id,
  className,
}: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative h-7 w-[46px] shrink-0 rounded-[15px] transition-colors duration-state ease-out",
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
        checked ? "bg-lime" : "bg-hair-2",
        disabled && "pointer-events-none opacity-40",
        className,
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-[22px] rounded-[11px] bg-white",
          "shadow-[0_2px_5px_rgba(31,42,35,0.2)] transition-all duration-state ease-out",
          checked ? "left-[21px]" : "left-[3px]",
        )}
      />
    </button>
  );
}
