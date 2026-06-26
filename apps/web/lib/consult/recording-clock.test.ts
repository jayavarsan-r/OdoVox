import { describe, expect, it } from 'vitest';
import { elapsedMs, isPaused, pauseClock, resumeClock, startClock } from './recording-clock';

describe('recording clock (pause/resume timing)', () => {
  it('elapsed advances while recording', () => {
    const c = startClock(1000);
    expect(elapsedMs(c, 1000)).toBe(0);
    expect(elapsedMs(c, 6000)).toBe(5000);
  });

  it('FREEZES the displayed time while paused (the Phase-3 bug)', () => {
    let c = startClock(0);
    c = pauseClock(c, 10_000); // pause at 10s
    expect(isPaused(c)).toBe(true);
    // Real time marches on, but the clock stays frozen at 10s.
    expect(elapsedMs(c, 10_000)).toBe(10_000);
    expect(elapsedMs(c, 25_000)).toBe(10_000);
  });

  it('resumes from where it froze, excluding the paused span', () => {
    let c = startClock(0);
    c = pauseClock(c, 10_000); // pause at 10s
    c = resumeClock(c, 25_000); // resume after 15s paused
    expect(isPaused(c)).toBe(false);
    // At resume the elapsed continues from 10s (not 25s).
    expect(elapsedMs(c, 25_000)).toBe(10_000);
    // 5s of further recording → 15s total (matches a 10s + 5s audio capture).
    expect(elapsedMs(c, 30_000)).toBe(15_000);
  });

  it('handles multiple pause/resume cycles', () => {
    let c = startClock(0);
    c = pauseClock(c, 5_000);
    c = resumeClock(c, 8_000); // 3s paused
    c = pauseClock(c, 12_000);
    c = resumeClock(c, 20_000); // +8s paused = 11s total paused
    expect(elapsedMs(c, 20_000)).toBe(9_000); // 20s wall - 11s paused
  });

  it('pause is idempotent; resume on a running clock is a no-op', () => {
    let c = startClock(0);
    c = pauseClock(c, 5_000);
    const again = pauseClock(c, 9_000); // already paused → unchanged
    expect(again.pauseStartedAt).toBe(5_000);
    expect(resumeClock(startClock(0), 1_000)).toEqual(startClock(0)); // resume while running → no-op
  });
});
