/**
 * Which Flow state `/home` is in — frames 13 through 17.
 *
 * The spec draws each as its own frame, so the app needs one place that decides which
 * one is true. That decision belongs in pure logic, not inside JSX: it has five outcomes
 * with real boundaries between them, and every boundary is a thing that can be wrong at
 * 9am in a real clinic.
 *
 * Derived from queue, schedule and network state only — never a mock toggle.
 */

export type FlowState =
  /** Frame 13 — someone is in the chair. */
  | "in-chair"
  /** Frame 14 — chair empty, people waiting. */
  | "chair-free"
  /** Frame 15 — chair empty, nobody waiting, but the day has more booked. */
  | "quiet"
  /** Frame 16 — every appointment recorded and nobody left. */
  | "day-done"
  /** Frame 13's empty cousin — nothing booked at all. */
  | "empty-day";

export interface FlowInput {
  /** Appointments booked today, any status. */
  total: number;
  /** How many are recorded/completed. */
  done: number;
  /** Someone is in the chair right now. */
  inChair: boolean;
  /** Patients waiting to be called in. */
  waiting: number;
}

/**
 * Precedence matters and is not arbitrary:
 *
 *  1. IN-CHAIR wins over everything. A patient in the chair is the most urgent thing on
 *     the screen even if the rest of the day is finished — otherwise a doctor mid-
 *     obturation would see "That's all 8" while the patient is still sitting there.
 *  2. CHAIR-FREE next, ahead of BOTH empty-day and day-done. Anyone waiting is an
 *     action; the calendar is not. A walk-in on a day with nothing booked must not read
 *     as "nothing today", and a walk-in after the last booked visit must not read as
 *     "that's all 8" — in both cases there is a person in the waiting room.
 *  3. EMPTY-DAY before day-done, so a clinic with nothing booked is not congratulated
 *     for finishing ("0 of 0 recorded" is not an achievement).
 *  4. DAY-DONE only when everything booked is recorded. One unrecorded visit keeps the
 *     day open.
 */
export function flowState(input: FlowInput): FlowState {
  const total = Math.max(0, Math.floor(input.total));
  const done = Math.min(Math.max(0, Math.floor(input.done)), total);
  const waiting = Math.max(0, Math.floor(input.waiting));

  if (input.inChair) return "in-chair";
  if (waiting > 0) return "chair-free";
  if (total === 0) return "empty-day";
  if (done >= total) return "day-done";
  return "quiet";
}

/**
 * The offline banner is ADDITIVE, not a state.
 *
 * Frame 17 keeps the normal hero and puts a concerned-Odo banner above it — recording,
 * notes and checkout all still work offline, so replacing the screen would be a lie
 * about what the app can still do.
 */
export function showsOfflineBanner(online: boolean): boolean {
  return !online;
}
