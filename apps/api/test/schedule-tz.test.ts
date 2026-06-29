import { describe, expect, it } from 'vitest';
import {
  dayOfWeekOf,
  localDateISO,
  localDateTimeToUtc,
  utcToZonedParts,
} from '../src/lib/schedule/tz.js';

const TZ = 'Asia/Kolkata'; // UTC+05:30, no DST

describe('schedule tz helpers', () => {
  it('converts clinic-local wall time to the right UTC instant (Kolkata = +05:30)', () => {
    // 2026-06-25 09:00 IST === 03:30 UTC
    const utc = localDateTimeToUtc('2026-06-25', '09:00', TZ);
    expect(utc.toISOString()).toBe('2026-06-25T03:30:00.000Z');
  });

  it('round-trips a UTC instant back to local parts', () => {
    const utc = localDateTimeToUtc('2026-06-25', '14:30', TZ);
    const p = utcToZonedParts(utc, TZ);
    expect(p).toMatchObject({ year: 2026, month: 6, day: 25, hour: 14, minute: 30 });
  });

  it('computes the clinic-local day-of-week (Thu=4, Sun=0)', () => {
    expect(dayOfWeekOf('2026-06-25', TZ)).toBe(4); // Thursday
    expect(dayOfWeekOf('2026-06-28', TZ)).toBe(0); // Sunday
  });

  it('keeps the local calendar date even when the UTC date differs', () => {
    // 2026-06-25 02:00 IST === 2026-06-24 20:30 UTC, but the local day is still the 25th.
    const utc = localDateTimeToUtc('2026-06-25', '02:00', TZ);
    expect(utc.getUTCDate()).toBe(24);
    expect(localDateISO(utc, TZ)).toBe('2026-06-25');
  });
});
