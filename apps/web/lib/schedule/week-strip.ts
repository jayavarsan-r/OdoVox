import { addDaysISO, dayOfWeekOfISO } from './tz.js';

export interface DayPill {
  iso: string;
  letter: string; // S M T W T F S
  dayNum: number; // 1-31
  dayOfWeek: number; // 0-6
  isToday: boolean;
  isFocus: boolean;
  isOffDay: boolean;
}

const LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** The Sun-start week containing `focusISO`, as 7 day pills (§7.1 week strip). */
export function buildWeekStrip(input: { focusISO: string; todayISO: string; weeklyOffDays: number[] }): DayPill[] {
  const { focusISO, todayISO, weeklyOffDays } = input;
  const focusDow = dayOfWeekOfISO(focusISO);
  const sundayISO = addDaysISO(focusISO, -focusDow);
  return Array.from({ length: 7 }, (_, i) => {
    const iso = addDaysISO(sundayISO, i);
    const dayNum = Number(iso.split('-')[2]);
    return {
      iso,
      letter: LETTERS[i]!,
      dayNum,
      dayOfWeek: i,
      isToday: iso === todayISO,
      isFocus: iso === focusISO,
      isOffDay: weeklyOffDays.includes(i),
    };
  });
}

/** Step the focus date by ±1 day or ±1 week. */
export function shiftFocus(focusISO: string, by: 'prev-day' | 'next-day' | 'prev-week' | 'next-week'): string {
  switch (by) {
    case 'prev-day':
      return addDaysISO(focusISO, -1);
    case 'next-day':
      return addDaysISO(focusISO, 1);
    case 'prev-week':
      return addDaysISO(focusISO, -7);
    case 'next-week':
      return addDaysISO(focusISO, 7);
  }
}
