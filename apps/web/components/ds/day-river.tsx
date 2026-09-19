"use client";

import { dayRiverSegments, type DayRiverInput } from "@/lib/ds/day-river";
import { cn } from "@/lib/utils";

/**
 * `.dayriver` — the habit loop (v9 frame 13).
 *
 * "8 segments, one per appointment: lime = done, dark = in the chair now, hollow =
 *  ahead. One glance = where am I in my day; filling it is the daily loop."
 *
 * This is the component that replaced Home's stat pills — their numbers moved into the
 * caption line beneath, because a doctor mid-clinic wants shape, not arithmetic.
 *
 * Spec: segments flex-1 at 7px tall, radius 4, gap 5, on #E9EDDE. Done = lime.
 * Current = pine with a 3px lime-glow halo. Tapping goes to Schedule (tap contract).
 */
export interface DayRiverProps extends DayRiverInput {
  /** e.g. "3 seen · Anand in the chair · 4 to go · ₹7,950 in" */
  caption?: React.ReactNode;
  onSelect?: () => void;
  className?: string;
}

export function DayRiver({
  caption,
  onSelect,
  className,
  ...input
}: DayRiverProps) {
  const segments = dayRiverSegments(input);
  if (segments.length === 0) return null;

  const doneCount = segments.filter((s) => s === "done").length;
  const summary = `${doneCount} of ${segments.length} appointments recorded`;

  const river = (
    <span className="flex gap-[5px]" aria-hidden>
      {segments.map((state, i) => (
        <span
          key={i}
          className={cn(
            "h-[7px] flex-1 rounded-[4px] transition-colors duration-state",
            state === "done" && "bg-lime",
            state === "current" &&
              "bg-pine shadow-[0_0_0_3px_rgba(205,231,99,0.5)]",
            state === "ahead" && "bg-[#E9EDDE]",
          )}
        />
      ))}
    </span>
  );

  return (
    <div className={cn("px-gutter pt-[11px]", className)}>
      {onSelect ? (
        <button
          type="button"
          onClick={onSelect}
          aria-label={`${summary}. Open the schedule.`}
          className="block w-full rounded-sm focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]"
        >
          {river}
        </button>
      ) : (
        <div role="img" aria-label={summary}>
          {river}
        </div>
      )}
      {caption ? (
        <p className="pt-[7px] text-xs font-bold text-pine-2">{caption}</p>
      ) : null}
    </div>
  );
}
