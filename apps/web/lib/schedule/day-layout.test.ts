import { describe, expect, it } from 'vitest';
import { buildDayLayout, type ClinicHoursLite } from './day-layout';
import type { ScheduleAppointment } from '@odovox/types';

const TZ = 'Asia/Kolkata';
const hours: ClinicHoursLite = {
  open: '09:00',
  close: '18:00',
  lunchStart: '13:00',
  lunchEnd: '14:00',
  weeklyOffDays: [0],
  timezone: TZ,
};

// 2026-06-25 is a Thursday; 10:00 IST = 04:30Z.
const iso = (hhmm: string) => `2026-06-25T${hhmm}:00+05:30`;

function appt(over: Partial<ScheduleAppointment> = {}): ScheduleAppointment {
  return {
    id: over.id ?? 'a1',
    clinicId: 'c',
    patientId: 'p',
    patientName: 'Asha',
    doctorId: 'd',
    doctorName: 'Dr',
    roomId: null,
    roomName: null,
    startsAt: new Date(over.startsAt ?? iso('10:00')),
    endsAt: new Date(over.endsAt ?? iso('10:30')),
    durationMinutes: over.durationMinutes ?? 30,
    status: over.status ?? 'SCHEDULED',
    procedureHint: over.procedureHint ?? 'Cleaning',
    notes: null,
    seriesId: null,
    seriesIndex: null,
    seriesTotal: null,
    treatmentPlanId: null,
    sittingNumber: null,
    originalStartsAt: null,
    rescheduleCount: 0,
  } as ScheduleAppointment;
}

describe('buildDayLayout', () => {
  it('positions a block by minutes from clinic open', () => {
    const layout = buildDayLayout({ dateISO: '2026-06-25', clinicHours: hours, appointments: [appt()] });
    expect(layout.blocks).toHaveLength(1);
    expect(layout.blocks[0]!.topMinutes).toBe(60); // 10:00 is 60 min after 09:00 open
    expect(layout.blocks[0]!.heightMinutes).toBe(30);
    expect(layout.blocks[0]!.tone).toBe('sky'); // Cleaning → sky
  });

  it('marks weekly off days', () => {
    const sun = buildDayLayout({ dateISO: '2026-06-28', clinicHours: hours, appointments: [] }); // Sunday
    expect(sun.isOffDay).toBe(true);
    const thu = buildDayLayout({ dateISO: '2026-06-25', clinicHours: hours, appointments: [] });
    expect(thu.isOffDay).toBe(false);
  });

  it('honours a forced day-off', () => {
    const layout = buildDayLayout({ dateISO: '2026-06-25', clinicHours: hours, appointments: [], forcedOffDay: true });
    expect(layout.isOffDay).toBe(true);
  });

  it('computes the lunch band relative to open', () => {
    const layout = buildDayLayout({ dateISO: '2026-06-25', clinicHours: hours, appointments: [] });
    expect(layout.lunch).toEqual({ topMinutes: 240, heightMinutes: 60 }); // 13:00 = 240 after 09:00
  });

  it('builds hour marks across the working window', () => {
    const layout = buildDayLayout({ dateISO: '2026-06-25', clinicHours: hours, appointments: [] });
    expect(layout.hourMarks[0]).toEqual({ minutesFromOpen: 0, label: '9 AM' });
    expect(layout.hourMarks.at(-1)).toEqual({ minutesFromOpen: 540, label: '6 PM' });
  });

  it('shows the now-line only on the matching local day and within hours', () => {
    const noon = new Date(iso('12:00'));
    const onDay = buildDayLayout({ dateISO: '2026-06-25', clinicHours: hours, appointments: [], now: noon });
    expect(onDay.nowLineMinutes).toBe(180); // 12:00 = 180 after 09:00
    const otherDay = buildDayLayout({ dateISO: '2026-06-26', clinicHours: hours, appointments: [], now: noon });
    expect(otherDay.nowLineMinutes).toBeNull();
  });

  it('excludes cancelled appointments', () => {
    const layout = buildDayLayout({
      dateISO: '2026-06-25',
      clinicHours: hours,
      appointments: [appt({ status: 'CANCELLED' })],
    });
    expect(layout.blocks).toHaveLength(0);
  });
});
