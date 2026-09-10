"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * `.bars` — the bar strip (v9 frames 20, 54, 72).
 *
 * Hourly collection on Billing, six-month WhatsApp spend, the busiest-day strip in
 * Week in review. Always a shape-at-a-glance, never a precise chart — that is why the
 * axis labels are optional and there is no y-axis at all.
 *
 * Spec: bars flex-1, radius `6px 6px 3px 3px` (rounded on top, nearly square at the
 * base), lime-soft with the peak in full lime. Stagger in at --stagger-bars.
 *
 * Animates transform (scaleY) ONLY — Global Constraint 13 forbids animating height,
 * which would force layout on every frame of every bar.
 */
export interface BarDatum {
  /** Any non-negative magnitude; the strip normalises to its own max. */
  value: number;
  /** Axis label beneath, e.g. "9", "FEB", "M". */
  label?: string;
}

export function Bars({
  data,
  className,
  height = 64,
}: {
  data: BarDatum[];
  className?: string;
  height?: number;
}) {
  const reduced = useReducedMotion();
  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => Math.max(0, d.value)), 0);
  const peak = data.reduce(
    (best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best),
    0,
  );

  return (
    <div className={className}>
      <div className="flex items-end gap-2 px-1" style={{ height }}>
        {data.map((d, i) => {
          // A flat all-zero strip still renders visible stubs rather than nothing,
          // so an empty day reads as "no revenue yet", not as a broken component.
          const pct =
            max > 0 ? Math.max(0.06, Math.max(0, d.value) / max) : 0.06;
          return (
            <motion.span
              key={i}
              className={cn(
                "flex-1 origin-bottom rounded-[6px_6px_3px_3px]",
                i === peak && max > 0 ? "bg-lime" : "bg-lime-soft",
              )}
              style={{ height: `${pct * 100}%` }}
              initial={reduced ? false : { scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{
                delay: reduced ? 0 : i * 0.05,
                type: "spring",
                stiffness: 320,
                damping: 26,
              }}
            />
          );
        })}
      </div>
      {data.some((d) => d.label) ? (
        <div className="mt-[5px] flex justify-between px-1">
          {data.map((d, i) => (
            <span
              key={i}
              className="flex-1 text-center text-tiny font-heavy text-pine-3"
            >
              {d.label ?? ""}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
