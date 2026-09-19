'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

/**
 * A number that TICKS to its new value instead of swapping.
 *
 * A figure that changes instantly makes you re-read it to work out whether it changed at all
 * — you saw ₹5,800 and now you see ₹6,600, and nothing told you which was the event. A count
 * that rolls says "this just moved" without a word of copy, and it says it in the corner of
 * your eye while you are looking somewhere else. That is the whole trick: the clinic's
 * screens are glanced at, not read.
 *
 * DELIBERATELY UNDERSTATED. This is not a slot machine. It is a 600ms ease-out roll with no
 * overshoot and no colour change, because every number on these screens is money, a patient
 * count, or a stock level — facts that should feel stated, not performed. An outstanding
 * balance that bounces is a balance nobody trusts.
 *
 * It only animates a CHANGE, never the first paint: a screen whose figures roll up from zero
 * on arrival makes the reader wait to learn what they already loaded the page to see.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  durationMs = 600,
  className,
}: {
  value: number;
  /** Render the in-between values — e.g. rupees(), or a plain integer. */
  format?: (n: number) => string;
  durationMs?: number;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef<number | null>(null);
  // `true` until the first change, so arriving at a screen does not roll every figure on it.
  const firstPaint = useRef(true);

  useEffect(() => {
    if (firstPaint.current) {
      firstPaint.current = false;
      from.current = value;
      setShown(value);
      return;
    }
    // Respecting the OS setting is not optional: someone who asked for less motion asked for
    // the number, not the journey to it.
    if (reduced) {
      from.current = value;
      setShown(value);
      return;
    }

    const start = performance.now();
    const origin = from.current;
    const delta = value - origin;
    if (delta === 0) return;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out cubic. Decelerating only — a number that accelerates as it lands reads as
      // unstable, and these are figures people act on.
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(origin + delta * eased);
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      } else {
        from.current = value;
      }
    };

    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      // Land on the truth if we are interrupted mid-roll — a half-finished count left on
      // screen is worse than no animation, because it is simply a wrong number.
      from.current = value;
    };
  }, [value, durationMs, reduced]);

  // `tabular-nums` is load-bearing: without it every frame re-measures and the figure jitters
  // sideways as digits change width.
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {format(shown)}
    </span>
  );
}
