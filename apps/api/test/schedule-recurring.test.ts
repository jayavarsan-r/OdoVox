import { describe, expect, it } from 'vitest';
import { generateRecurringSeries } from '../src/lib/schedule/recurring.js';
import { localDateISO, localDateTimeToUtc, utcToZonedParts } from '../src/lib/schedule/tz.js';
import type {
  AvailabilityWindow,
  DayOffInput,
  ExistingAppointment,
  ScheduleClinicHours,
} from '../src/lib/schedule/types.js';

const TZ = 'Asia/Kolkata';
const THU = '2026-06-25'; // Thursday
const DOC = 'doc1';

const clinic: ScheduleClinicHours = {
  open: '09:00',
  close: '18:00',
  lunchStart: '13:00',
  lunchEnd: '14:00',
  weeklyOffDays: [0],
  timezone: TZ,
};
// Doctor works every weekday (Mon-Sat: dow 1..6) 09:00-18:00.
const weekdayWindows: AvailabilityWindow[] = [1, 2, 3, 4, 5, 6].map((d) => ({
  doctorId: DOC,
  dayOfWeek: d,
  startTime: '09:00',
  endTime: '18:00',
}));

const base = {
  firstStartsAt: localDateTimeToUtc(THU, '10:00', TZ),
  durationMinutes: 30,
  doctorId: DOC,
  doctorAvailability: weekdayWindows,
  clinicHours: clinic,
  dayOffs: [] as DayOffInput[],
  existingAppointments: [] as ExistingAppointment[],
  bufferMinutes: 5,
  slotGranularityMinutes: 30,
};

const hhmm = (d: Date) => {
  const p = utcToZonedParts(d, TZ);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
};

describe('generateRecurringSeries', () => {
  it('schedules 4 weekly occurrences 7 days apart at the requested time', () => {
    const { plan, unscheduled } = generateRecurringSeries({
      ...base,
      totalOccurrences: 4,
      interval: 'WEEKLY',
    });
    expect(unscheduled).toEqual([]);
    expect(plan.map((p) => p.seriesIndex)).toEqual([1, 2, 3, 4]);
    expect(plan.map((p) => localDateISO(p.startsAt, TZ))).toEqual([
      '2026-06-25',
      '2026-07-02',
      '2026-07-09',
      '2026-07-16',
    ]);
    expect(plan.every((p) => hhmm(p.startsAt) === '10:00')).toBe(true);
  });

  it('rolls forward to the next available date when the interval lands on a day-off', () => {
    // The 2nd occurrence would land on 2026-07-02 (Thu); block it clinic-wide → expect 07-03.
    const dayOffs: DayOffInput[] = [{ date: localDateTimeToUtc('2026-07-02', '00:00', TZ), scope: 'CLINIC' }];
    const { plan, unscheduled } = generateRecurringSeries({
      ...base,
      totalOccurrences: 2,
      interval: 'WEEKLY',
      dayOffs,
    });
    expect(unscheduled).toEqual([]);
    expect(localDateISO(plan[1]!.startsAt, TZ)).toBe('2026-07-03');
  });

  it('marks an occurrence unscheduled when no slot exists within the 7-day lookahead', () => {
    // Doctor only works Thursdays; the weekly target is always a Thursday but block 4 Thursdays so
    // the 2nd occurrence (target 07-02 Thu) finds nothing within 7 days.
    const thursdayOnly: AvailabilityWindow[] = [
      { doctorId: DOC, dayOfWeek: 4, startTime: '09:00', endTime: '18:00' },
    ];
    const dayOffs: DayOffInput[] = ['2026-07-02', '2026-07-09'].map((d) => ({
      date: localDateTimeToUtc(d, '00:00', TZ),
      scope: 'CLINIC' as const,
    }));
    const { plan, unscheduled } = generateRecurringSeries({
      ...base,
      totalOccurrences: 2,
      interval: 'WEEKLY',
      doctorAvailability: thursdayOnly,
      dayOffs,
    });
    expect(plan.map((p) => p.seriesIndex)).toEqual([1]);
    expect(unscheduled.map((u) => u.index)).toEqual([2]);
  });

  it('respects the buffer against an already-booked slot, choosing a later free time', () => {
    // Block 10:00-10:30 on the first target date; the requested 10:00 is taken so it picks a later
    // slot that clears the 5-min buffer.
    const existing: ExistingAppointment[] = [
      {
        id: 'x',
        doctorId: DOC,
        roomId: null,
        startsAt: localDateTimeToUtc(THU, '10:00', TZ),
        endsAt: localDateTimeToUtc(THU, '10:30', TZ),
        status: 'SCHEDULED',
      },
    ];
    const { plan } = generateRecurringSeries({
      ...base,
      totalOccurrences: 1,
      interval: 'WEEKLY',
      existingAppointments: existing,
    });
    expect(localDateISO(plan[0]!.startsAt, TZ)).toBe('2026-06-25');
    expect(hhmm(plan[0]!.startsAt)).not.toBe('10:00');
    // The picked slot must clear the 5-min buffer around the existing 10:00-10:30 booking: it ends
    // by 09:55 (before) or starts at/after 10:35 (after).
    const s = plan[0]!.startsAt.getTime();
    const e = plan[0]!.endsAt.getTime();
    const busyStart = localDateTimeToUtc(THU, '09:55', TZ).getTime();
    const busyEnd = localDateTimeToUtc(THU, '10:35', TZ).getTime();
    expect(e <= busyStart || s >= busyEnd).toBe(true);
  });

  it('supports monthly intervals', () => {
    const { plan } = generateRecurringSeries({
      ...base,
      totalOccurrences: 3,
      interval: 'MONTHLY',
    });
    expect(plan.map((p) => localDateISO(p.startsAt, TZ))).toEqual([
      '2026-06-25',
      '2026-07-25',
      '2026-08-25',
    ]);
  });
});
