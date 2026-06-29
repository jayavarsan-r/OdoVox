import { describe, expect, it } from 'vitest';
import { getAvailableSlots } from '../src/lib/schedule/availability.js';
import { localDateTimeToUtc } from '../src/lib/schedule/tz.js';
import type {
  AvailabilityWindow,
  DayOffInput,
  ExistingAppointment,
  ScheduleClinicHours,
} from '../src/lib/schedule/types.js';

const TZ = 'Asia/Kolkata';
const THU = '2026-06-25'; // Thursday (dow 4)
const SUN = '2026-06-28'; // Sunday (dow 0)
const DOC = 'doc1';

const clinic: ScheduleClinicHours = {
  open: '09:00',
  close: '18:00',
  lunchStart: '13:00',
  lunchEnd: '14:00',
  weeklyOffDays: [0], // Sunday closed
  timezone: TZ,
};

const fullThu: AvailabilityWindow = { doctorId: DOC, dayOfWeek: 4, startTime: '09:00', endTime: '18:00' };

function appt(date: string, from: string, to: string, over: Partial<ExistingAppointment> = {}): ExistingAppointment {
  return {
    id: over.id ?? `${from}-${to}`,
    doctorId: over.doctorId ?? DOC,
    roomId: over.roomId ?? null,
    patientId: over.patientId,
    startsAt: localDateTimeToUtc(date, from, TZ),
    endsAt: localDateTimeToUtc(date, to, TZ),
    status: over.status ?? 'SCHEDULED',
  };
}

const base = {
  doctorId: DOC,
  doctorAvailability: [fullThu],
  clinicHours: clinic,
  dayOffs: [] as DayOffInput[],
  existingAppointments: [] as ExistingAppointment[],
  durationMinutes: 30,
  bufferMinutes: 5,
  slotGranularityMinutes: 30,
};

const startsOf = (slots: { startsAt: Date }[]) =>
  slots.map((s) => s.startsAt.toISOString());

describe('getAvailableSlots', () => {
  it('returns no slots on a clinic weekly-off day', () => {
    expect(getAvailableSlots({ ...base, dateISO: SUN }).length).toBe(0);
  });

  it('produces slots within clinic hours', () => {
    const slots = getAvailableSlots({ ...base, dateISO: THU });
    expect(slots[0]!.startsAt.toISOString()).toBe(localDateTimeToUtc(THU, '09:00', TZ).toISOString());
    const last = slots[slots.length - 1]!;
    expect(last.endsAt.getTime()).toBeLessThanOrEqual(localDateTimeToUtc(THU, '18:00', TZ).getTime());
  });

  it('skips the lunch break', () => {
    const slots = getAvailableSlots({ ...base, dateISO: THU });
    const lunchStart = localDateTimeToUtc(THU, '13:00', TZ).getTime();
    const lunchEnd = localDateTimeToUtc(THU, '14:00', TZ).getTime();
    const inLunch = slots.some((s) => s.startsAt.getTime() < lunchEnd && s.endsAt.getTime() > lunchStart);
    expect(inLunch).toBe(false);
    // 09:00-13:00 (8) + 14:00-18:00 (8) = 16 half-hour slots.
    expect(slots.length).toBe(16);
  });

  it("intersects the doctor's narrower hours with the clinic envelope", () => {
    const narrow: AvailabilityWindow = { doctorId: DOC, dayOfWeek: 4, startTime: '10:00', endTime: '12:00' };
    const slots = getAvailableSlots({ ...base, dateISO: THU, doctorAvailability: [narrow] });
    expect(startsOf(slots)).toEqual([
      localDateTimeToUtc(THU, '10:00', TZ).toISOString(),
      localDateTimeToUtc(THU, '10:30', TZ).toISOString(),
      localDateTimeToUtc(THU, '11:00', TZ).toISOString(),
      localDateTimeToUtc(THU, '11:30', TZ).toISOString(),
    ]);
  });

  it('enforces the buffer around existing appointments', () => {
    const slots = getAvailableSlots({
      ...base,
      dateISO: THU,
      existingAppointments: [appt(THU, '10:00', '10:30')],
    });
    const has = (t: string) => startsOf(slots).includes(localDateTimeToUtc(THU, t, TZ).toISOString());
    // buffer 5 → busy window 09:55-10:35 blocks the 09:30, 10:00 and 10:30 starts.
    expect(has('09:30')).toBe(false);
    expect(has('10:00')).toBe(false);
    expect(has('10:30')).toBe(false);
    expect(has('09:00')).toBe(true);
    expect(has('11:00')).toBe(true);
  });

  it('excludes slots overlapping a booked appointment', () => {
    const slots = getAvailableSlots({
      ...base,
      dateISO: THU,
      bufferMinutes: 0,
      existingAppointments: [appt(THU, '10:00', '11:00')],
    });
    const has = (t: string) => startsOf(slots).includes(localDateTimeToUtc(THU, t, TZ).toISOString());
    expect(has('10:00')).toBe(false);
    expect(has('10:30')).toBe(false);
    expect(has('11:00')).toBe(true);
  });

  it('ignores cancelled/no-show appointments when computing busy times', () => {
    const slots = getAvailableSlots({
      ...base,
      dateISO: THU,
      bufferMinutes: 0,
      existingAppointments: [appt(THU, '10:00', '11:00', { status: 'CANCELLED' })],
    });
    const has = (t: string) => startsOf(slots).includes(localDateTimeToUtc(THU, t, TZ).toISOString());
    expect(has('10:00')).toBe(true);
  });

  it('returns no slots when a clinic-scope day-off covers the date', () => {
    const dayOffs: DayOffInput[] = [{ date: localDateTimeToUtc(THU, '00:00', TZ), scope: 'CLINIC' }];
    expect(getAvailableSlots({ ...base, dateISO: THU, dayOffs }).length).toBe(0);
  });

  it('blocks only the affected doctor on a doctor-scope day-off', () => {
    const dayOffs: DayOffInput[] = [
      { date: localDateTimeToUtc(THU, '00:00', TZ), scope: 'DOCTOR', doctorId: DOC },
    ];
    expect(getAvailableSlots({ ...base, dateISO: THU, dayOffs }).length).toBe(0);
    // A different doctor with the same availability is unaffected.
    const other: AvailabilityWindow = { ...fullThu, doctorId: 'doc2' };
    const slots = getAvailableSlots({
      ...base,
      dateISO: THU,
      doctorId: 'doc2',
      doctorAvailability: [other],
      dayOffs,
    });
    expect(slots.length).toBeGreaterThan(0);
  });

  it('returns no slots when the doctor has no window that weekday', () => {
    expect(getAvailableSlots({ ...base, dateISO: THU, doctorAvailability: [] }).length).toBe(0);
  });
});
