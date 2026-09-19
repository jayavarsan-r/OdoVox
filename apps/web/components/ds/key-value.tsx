import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * `.kv` — the key/value row. Checkout line items, lab case history, inventory
 * movements, the switch-role summary, the voice-confirm sheet.
 *
 * Spec: flex, space-between, padding 11px 18px, hairline between rows.
 * Key 13.5/500 pine-2 — deliberately lighter than the value, because the value is
 * what the user is reading. Value 13.5/800 tabular-nums.
 *
 * `tone` colours the value for signed movements: crit for stock out and refunds,
 * live for stock in and payments. Frame 68's ledger depends on that being readable
 * at a glance without parsing the sign.
 */
export interface KeyValueProps {
  label: React.ReactNode;
  value: React.ReactNode;
  tone?: "default" | "crit" | "live" | "warn";
  className?: string;
}

const TONE = {
  default: "text-pine",
  crit: "text-crit",
  live: "text-live",
  warn: "text-warn",
} as const;

export function KeyValue({
  label,
  value,
  tone = "default",
  className,
}: KeyValueProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 px-[18px] py-[11px]",
        "[&+&]:border-t [&+&]:border-hair",
        className,
      )}
    >
      <span className="text-body font-regular text-pine-2">{label}</span>
      <span className={cn("text-body font-heavy tabular-nums", TONE[tone])}>
        {value}
      </span>
    </div>
  );
}
