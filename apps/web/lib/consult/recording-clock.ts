/**
 * Pure pause-aware recording clock. The Phase 3 store tracked `startedAt` + a never-updated
 * `pausedMs`, so the on-screen timer kept ticking while paused (and the displayed duration drifted
 * ahead of the actual audio) — which read as "Pause doesn't work". This isolates the time maths so
 * it can be unit-tested; the store just holds one of these and calls these functions.
 */
export interface RecordingClock {
  startedAt: number;
  /** Total accumulated paused time (ms) across completed pauses. */
  pausedMs: number;
  /** When the CURRENT pause began (ms epoch), or null while recording. */
  pauseStartedAt: number | null;
}

export function startClock(now: number): RecordingClock {
  return { startedAt: now, pausedMs: 0, pauseStartedAt: null };
}

export function pauseClock(c: RecordingClock, now: number): RecordingClock {
  return c.pauseStartedAt != null ? c : { ...c, pauseStartedAt: now };
}

export function resumeClock(c: RecordingClock, now: number): RecordingClock {
  if (c.pauseStartedAt == null) return c;
  return { ...c, pausedMs: c.pausedMs + Math.max(0, now - c.pauseStartedAt), pauseStartedAt: null };
}

/** Elapsed recording time, EXCLUDING paused spans. Frozen at the pause moment while paused. */
export function elapsedMs(c: RecordingClock, now: number): number {
  const upTo = c.pauseStartedAt ?? now; // freeze the clock while paused
  return Math.max(0, upTo - c.startedAt - c.pausedMs);
}

export function isPaused(c: RecordingClock): boolean {
  return c.pauseStartedAt != null;
}
