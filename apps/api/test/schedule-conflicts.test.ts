import { describe, expect, it } from 'vitest';
import { detectConflicts } from '../src/lib/schedule/conflicts.js';
import { localDateTimeToUtc } from '../src/lib/schedule/tz.js';
import type {
  AvailabilityWindow,
  DayOffInput,
  ExistingAppointment,
  ScheduleClinicHours,
} from '../src/lib/schedule/types.js';

const TZ = 'Asia/Kolkata';
const THU = '2026-06-25'; // Thursday
const SUN = '2026-06-28'; // Sunday (clinic off)
const DOC = 'doc1';
const NOW = localDateTimeToUtc(THU, '08:00', TZ); // before the clinic opens, but "now" for past checks

const clinic: ScheduleClinicHours = {
  open: '09:00',
  close: '18:00',
  lunchStart: '13:00',
  lunchEnd: '14:00',
  weeklyOffDays: [0],
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

function run(over: Partial<Parameters<typeof detectConflicts>[0]['appointment']>, existing: ExistingAppointment[] = [], extra: Partial<Parameters<typeof detectConflicts>[0]> = {}) {
  return detectConflicts({
    appointment: {
      clinicId: 'c1',
      doctorId: DOC,
      startsAt: localDateTimeToUtc(THU, '10:00', TZ),
      endsAt: localDateTimeToUtc(THU, '10:30', TZ),
      ...over,
    },
    existingAppointments: existing,
    doctorAvailability: [fullThu],
    clinicHours: clinic,
    dayOffs: [],
    bufferMinutes: 5,
    now: NOW,
    ...extra,
  });
}

const codes = (cs: { code: string }[]) => cs.map((c) => c.code);
const hard = (cs: { kind: string }[]) => cs.filter((c) => c.kind === 'HARD');

describe('detectConflicts — HARD', () => {
  it('flags a double-booked doctor', () => {
    const c = run({}, [appt(THU, '10:15', '10:45')]);
    expect(codes(hard(c))).toContain('DOCTOR_DOUBLE_BOOKED');
  });

  it('flags a double-booked room', () => {
    const c = run({ roomId: 'r1' }, [appt(THU, '10:15', '10:45', { doctorId: 'other', roomId: 'r1' })]);
    expect(codes(hard(c))).toContain('ROOM_DOUBLE_BOOKED');
  });

  it('flags an appointment outside clinic hours', () => {
    const c = run({
      startsAt: localDateTimeToUtc(THU, '08:00', TZ),
      endsAt: localDateTimeToUtc(THU, '08:30', TZ),
    }, [], { now: localDateTimeToUtc(THU, '07:00', TZ) });
    expect(codes(hard(c))).toContain('OUTSIDE_CLINIC_HOURS');
  });

  it('flags a past-time appointment', () => {
    const c = run({}, [], { now: localDateTimeToUtc(THU, '11:00', TZ) });
    expect(codes(hard(c))).toContain('PAST_TIME');
  });

  it('flags a clinic weekly off day', () => {
    const c = run({
      startsAt: localDateTimeToUtc(SUN, '10:00', TZ),
      endsAt: localDateTimeToUtc(SUN, '10:30', TZ),
    }, [], { now: localDateTimeToUtc(SUN, '08:00', TZ) });
    expect(codes(hard(c))).toContain('WEEKLY_OFF_DAY');
  });

  it('flags a day-off block', () => {
    const dayOffs: DayOffInput[] = [{ date: localDateTimeToUtc(THU, '00:00', TZ), scope: 'CLINIC' }];
    const c = run({}, [], { dayOffs });
    expect(codes(hard(c))).toContain('DAY_OFF_BLOCKED');
  });
});

describe('detectConflicts — SOFT', () => {
  it('warns when overlapping the lunch break', () => {
    const c = run({
      startsAt: localDateTimeToUtc(THU, '13:15', TZ),
      endsAt: localDateTimeToUtc(THU, '13:45', TZ),
    });
    expect(codes(c)).toContain('IN_LUNCH_BREAK');
    expect(hard(c).length).toBe(0);
  });

  it('warns when the buffer to a neighbour is tight', () => {
    // Neighbour 10:30-11:00; our 10:00-10:30 leaves a 0-min gap (< 5 buffer), no overlap.
    const c = run({}, [appt(THU, '10:30', '11:00')]);
    expect(codes(c)).toContain('BUFFER_TIGHT');
    expect(codes(hard(c))).not.toContain('DOCTOR_DOUBLE_BOOKED');
  });

  it('warns when the patient already has an appointment that day', () => {
    const c = run({ patientId: 'p1' }, [appt(THU, '15:00', '15:30', { patientId: 'p1', doctorId: 'other' })]);
    expect(codes(c)).toContain('SAME_PATIENT_SAME_DAY');
  });

  it("warns when outside the doctor's availability (clinic open)", () => {
    const narrow: AvailabilityWindow = { doctorId: DOC, dayOfWeek: 4, startTime: '14:00', endTime: '18:00' };
    const c = run({}, [], { doctorAvailability: [narrow] }); // 10:00 is before doctor starts
    expect(codes(c)).toContain('DOCTOR_OUTSIDE_AVAILABILITY');
  });
});

describe('detectConflicts — exclude self', () => {
  it('does not double-book against the appointment being edited', () => {
    const self = appt(THU, '10:00', '10:30', { id: 'self' });
    const c = run({ excludeAppointmentId: 'self' }, [self]);
    expect(codes(hard(c))).not.toContain('DOCTOR_DOUBLE_BOOKED');
  });
});
