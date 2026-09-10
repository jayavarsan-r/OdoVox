/**
 * Orb press/hold logic (v9 frame 78).
 *
 * The orb is the fastest path to the app's core act — dictating — and it carries TWO
 * actions on one target:
 *
 *   tap        → the context action (record the patient in the chair, or go to Consult)
 *   hold 350ms → the voice menu
 *
 * The timing is the whole component. Get it wrong and either a tap fires the menu, or
 * a hold fires a recording against the wrong patient. Both are bad in a clinic, so the
 * state machine lives here, in isolation, under test — not inline in a component where
 * it can only be verified by hand.
 */

/** `--hold-threshold`. */
export const HOLD_MS = 350;

export type OrbState = "idle" | "pressing" | "held";

/** What the press resolved to when the pointer went up. */
export type OrbResolution = "tap" | "hold" | "none";

export interface OrbPress {
  state: OrbState;
  /** Timestamp the press began, for elapsed-time comparisons. */
  startedAt: number | null;
}

export const initialPress: OrbPress = { state: "idle", startedAt: null };

export function pressDown(now: number): OrbPress {
  return { state: "pressing", startedAt: now };
}

/**
 * The hold timer fired. Only promotes a press that is still down — a timer that
 * survives the pointer going up must not open the menu after the fact.
 */
export function holdFired(press: OrbPress): OrbPress {
  if (press.state !== "pressing") return press;
  return { ...press, state: "held" };
}

/**
 * Pointer up. A press already promoted to `held` resolves as a hold and MUST NOT also
 * fire the tap — that double-fire would start a recording behind the voice menu.
 */
export function pressUp(
  press: OrbPress,
  now: number,
): { next: OrbPress; resolution: OrbResolution } {
  if (press.state === "held") return { next: initialPress, resolution: "hold" };
  if (press.state === "pressing") {
    // Defensive: if the timer was starved (a busy main thread is normal on the mid-range
    // Android these clinics run), fall back to comparing elapsed time.
    const elapsed = press.startedAt === null ? 0 : now - press.startedAt;
    return {
      next: initialPress,
      resolution: elapsed >= HOLD_MS ? "hold" : "tap",
    };
  }
  return { next: initialPress, resolution: "none" };
}

/** Pointer cancelled or left the target — resolve to nothing, never to a tap. */
export function pressCancel(): { next: OrbPress; resolution: OrbResolution } {
  return { next: initialPress, resolution: "none" };
}
