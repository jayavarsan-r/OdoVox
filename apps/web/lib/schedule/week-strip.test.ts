import { describe, expect, it } from 'vitest';
import { buildWeekStrip, shiftFocus } from './week-strip';

describe('buildWeekStrip', () => {
  it('builds the Sun-start week containing the focus date', () => {
    // 2026-06-25 is a Thursday → week runs Sun 21 .. Sat 27.
    const week = buildWeekStrip({ focusISO: '2026-06-25', todayISO: '2026-06-23', weeklyOffDays: [0] });
    expect(week).toHaveLength(7);
    expect(week[0]!.iso).toBe('2026-06-21');
    expect(week[6]!.iso).toBe('2026-06-27');
    expect(week.map((d) => d.letter)).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);
  });

  it('flags today, focus, and off days', () => {
    const week = buildWeekStrip({ focusISO: '2026-06-25', todayISO: '2026-06-23', weeklyOffDays: [0] });
    expect(week.find((d) => d.isFocus)!.iso).toBe('2026-06-25');
    expect(week.find((d) => d.isToday)!.iso).toBe('2026-06-23');
    expect(week[0]!.isOffDay).toBe(true); // Sunday
    expect(week[1]!.isOffDay).toBe(false);
  });
});

describe('shiftFocus', () => {
  it('steps by day and week', () => {
    expect(shiftFocus('2026-06-25', 'next-day')).toBe('2026-06-26');
    expect(shiftFocus('2026-06-25', 'prev-day')).toBe('2026-06-24');
    expect(shiftFocus('2026-06-25', 'next-week')).toBe('2026-07-02');
    expect(shiftFocus('2026-06-25', 'prev-week')).toBe('2026-06-18');
  });
});
