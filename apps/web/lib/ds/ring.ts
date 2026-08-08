/**
 * Progress-ring geometry for `<ProgressRing>` (v9-13, v9-14, v9-37).
 *
 * SVG draws an arc by dashing the circumference: `stroke-dasharray: <dash> <gap>`.
 * The ring is rotated -90° at render so the arc starts at 12 o'clock.
 */

export interface RingDash {
  /** Length of the drawn arc, in user units. */
  dash: number;
  /** Length of the gap that follows it. */
  gap: number;
}

/** Circumference of a circle with the given radius. */
export function circumference(radius: number): number {
  return 2 * Math.PI * radius;
}

/**
 * Split a circle's circumference into the drawn arc and its gap.
 *
 * Clamped to 0..max so a bad count can never draw a longer-than-full ring or a
 * negative dash — both of which render as visual garbage rather than an obvious bug.
 * `max <= 0` yields an empty ring rather than dividing by zero.
 */
export function ringDashArray(
  value: number,
  max: number,
  radius: number,
): RingDash {
  const total = circumference(radius);
  if (max <= 0 || !Number.isFinite(max)) return { dash: 0, gap: total };

  const safe = Math.min(Math.max(value, 0), max);
  const dash = (safe / max) * total;
  return { dash, gap: total - dash };
}
