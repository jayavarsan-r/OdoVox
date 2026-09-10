/**
 * Day-river segment states (v9 frame 13).
 *
 * "The habit hook is the day river — 8 segments, one per appointment: lime = done,
 *  dark = in the chair now, hollow = ahead. One glance = where am I in my day; filling
 *  it is the daily loop."
 *
 * One segment per appointment, so the river's LENGTH is the day's shape. It is not a
 * progress bar: a 3-appointment day and a 12-appointment day must look different at a
 * glance, which is why nothing here normalises to a percentage.
 */

export type SegmentState = "done" | "current" | "ahead";

export interface DayRiverInput {
  /** Appointments booked today. */
  total: number;
  /** How many have a confirmed record. */
  done: number;
  /** Zero-based index of the patient in the chair, or null when the chair is free. */
  currentIndex?: number | null;
}

/**
 * Build the segment list.
 *
 * Guards, in order of how likely each is to happen with real data:
 *  - a `currentIndex` outside the day (stale queue state after a reschedule) is ignored
 *    rather than throwing or drawing a segment that isn't there
 *  - `done` above `total` is clamped, so a double-confirm cannot overfill the river
 *  - a current index that has already been counted as done stays `current`, because the
 *    chair is the more useful truth at a glance
 */
export function dayRiverSegments(input: DayRiverInput): SegmentState[] {
  const total = Math.max(0, Math.floor(input.total));
  if (total === 0) return [];

  const done = Math.min(Math.max(0, Math.floor(input.done)), total);
  const rawCurrent = input.currentIndex;
  const current =
    rawCurrent === null ||
    rawCurrent === undefined ||
    rawCurrent < 0 ||
    rawCurrent >= total
      ? null
      : Math.floor(rawCurrent);

  return Array.from({ length: total }, (_, i) => {
    if (i === current) return "current";
    return i < done ? "done" : "ahead";
  });
}

/** True once every appointment has a confirmed record — the day-done state (frame 16). */
export function isDayComplete(input: DayRiverInput): boolean {
  const total = Math.max(0, Math.floor(input.total));
  return total > 0 && Math.min(input.done, total) >= total;
}
