"use client";

import { cn } from "@/lib/utils";

/**
 * `.seg` — the spec's segmented control. Day/Week/Month on Schedule, payment method
 * on Checkout, doctor picker on Walk-in, scope on Days off, gender on intake.
 *
 * Spec: 5% pine track, radius 999, 3px padding; options 34px tall, 12.5/600 pine-2;
 * the selected option is a white pill, 800 pine, `0 2px 8px rgba(31,42,35,.12)`.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Accessible name for the group, e.g. "Calendar range". */
  label: string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex flex-1 gap-0.5 rounded-pill bg-[rgba(31,42,35,0.05)] p-[3px]",
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-[34px] flex-1 items-center justify-center rounded-pill text-xs",
              "transition-all duration-state ease-out",
              "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
              selected
                ? "bg-white font-heavy text-pine shadow-[0_2px_8px_rgba(31,42,35,0.12)]"
                : "font-medium text-pine-2",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
