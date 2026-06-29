import type { Conflict } from '@odovox/types';
import { dayOfWeekOf, localDateISO, localDateTimeToUtc } from './tz.js';
import { dayOffCovers } from './availability.js';
import {
  type AvailabilityWindow,
  type DayOffInput,
  type ExistingAppointment,
  type ScheduleClinicHours,
  OCCUPYING_STATUSES,
} from './types.js';

const MINUTE_MS = 60_000;

export interface DetectConflictsInput {
  appointment: {
    clinicId: string;
    doctorId: string;
    roomId?: string | null;
    patientId?: string;
    startsAt: Date;
    endsAt: Date;
    excludeAppointmentId?: string;
  };
  existingAppointments: ExistingAppointment[];
  doctorAvailability: AvailabilityWindow[];
  clinicHours: ScheduleClinicHours;
  dayOffs: DayOffInput[];
  bufferMinutes?: number; // default 5
  now?: Date; // injectable clock for PAST_TIME (pure/testable)
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number): boolean =>
  aStart < bEnd && aEnd > bStart;

/**
 * Server-side source of truth for whether an appointment can be booked. Pure + deterministic.
 * HARD conflicts block the write (409); SOFT conflicts warn and may be overridden by the caller
 * acknowledging the code. Rule set matches Phase 6 spec §2.2.
 */
export function detectConflicts(input: DetectConflictsInput): Conflict[] {
  const {
    appointment: appt,
    existingAppointments,
    doctorAvailability,
    clinicHours,
    dayOffs,
    bufferMinutes = 5,
    now = new Date(),
  } = input;
  const tz = clinicHours.timezone;
  const conflicts: Conflict[] = [];

  const start = appt.startsAt.getTime();
  const end = appt.endsAt.getTime();
  const dateISO = localDateISO(appt.startsAt, tz);
  const dow = dayOfWeekOf(dateISO, tz);

  const others = existingAppointments.filter(
    (a) => a.id !== appt.excludeAppointmentId && OCCUPYING_STATUSES.has(a.status),
  );

  // ── HARD ──────────────────────────────────────────────────────────────────────────────────
  if (start < now.getTime()) {
    conflicts.push({ kind: 'HARD', code: 'PAST_TIME', message: 'Appointment starts in the past.' });
  }

  if (clinicHours.weeklyOffDays.includes(dow)) {
    conflicts.push({
      kind: 'HARD',
      code: 'WEEKLY_OFF_DAY',
      message: 'The clinic is closed on this day of the week.',
    });
  }

  if (dayOffCovers(dayOffs, dateISO, tz, (d) => d.scope === 'CLINIC')) {
    conflicts.push({ kind: 'HARD', code: 'DAY_OFF_BLOCKED', message: 'The clinic is closed (day off).' });
  } else if (
    dayOffCovers(dayOffs, dateISO, tz, (d) => d.scope === 'DOCTOR' && d.doctorId === appt.doctorId)
  ) {
    conflicts.push({
      kind: 'HARD',
      code: 'DAY_OFF_BLOCKED',
      message: 'The doctor is off on this day.',
    });
  }

  const openMs = localDateTimeToUtc(dateISO, clinicHours.open, tz).getTime();
  const closeMs = localDateTimeToUtc(dateISO, clinicHours.close, tz).getTime();
  if (start < openMs || end > closeMs) {
    conflicts.push({
      kind: 'HARD',
      code: 'OUTSIDE_CLINIC_HOURS',
      message: 'Appointment falls outside clinic opening hours.',
    });
  }

  if (others.some((a) => a.doctorId === appt.doctorId && overlaps(start, end, a.startsAt.getTime(), a.endsAt.getTime()))) {
    conflicts.push({
      kind: 'HARD',
      code: 'DOCTOR_DOUBLE_BOOKED',
      message: 'The doctor already has an appointment at this time.',
    });
  }

  if (
    appt.roomId &&
    others.some(
      (a) => a.roomId === appt.roomId && overlaps(start, end, a.startsAt.getTime(), a.endsAt.getTime()),
    )
  ) {
    conflicts.push({
      kind: 'HARD',
      code: 'ROOM_DOUBLE_BOOKED',
      message: 'The room is already booked at this time.',
    });
  }

  // ── SOFT ──────────────────────────────────────────────────────────────────────────────────
  if (clinicHours.lunchStart && clinicHours.lunchEnd) {
    const ls = localDateTimeToUtc(dateISO, clinicHours.lunchStart, tz).getTime();
    const le = localDateTimeToUtc(dateISO, clinicHours.lunchEnd, tz).getTime();
    if (overlaps(start, end, ls, le)) {
      conflicts.push({
        kind: 'SOFT',
        code: 'IN_LUNCH_BREAK',
        message: 'Appointment overlaps the clinic lunch break.',
      });
    }
  }

  // BUFFER_TIGHT: a same-doctor neighbour sits closer than the buffer (but isn't overlapping —
  // that would already be a hard double-book).
  const bufferMs = bufferMinutes * MINUTE_MS;
  const tooTight = others.some((a) => {
    if (a.doctorId !== appt.doctorId) return false;
    const aS = a.startsAt.getTime();
    const aE = a.endsAt.getTime();
    if (overlaps(start, end, aS, aE)) return false; // overlap handled as HARD
    const gap = aS >= end ? aS - end : start - aE;
    return gap >= 0 && gap < bufferMs;
  });
  if (tooTight) {
    conflicts.push({
      kind: 'SOFT',
      code: 'BUFFER_TIGHT',
      message: `Less than ${bufferMinutes} min gap to a neighbouring appointment.`,
    });
  }

  // DOCTOR_OUTSIDE_AVAILABILITY: clinic is open but the doctor's weekly windows don't cover the slot.
  const coveredByDoctor = doctorAvailability.some((w) => {
    if (w.doctorId !== appt.doctorId || w.dayOfWeek !== dow) return false;
    if (w.effectiveFrom && localDateTimeToUtc(dateISO, '00:00', tz) < w.effectiveFrom) return false;
    if (w.effectiveTo && localDateTimeToUtc(dateISO, '00:00', tz) > w.effectiveTo) return false;
    const wS = localDateTimeToUtc(dateISO, w.startTime, tz).getTime();
    const wE = localDateTimeToUtc(dateISO, w.endTime, tz).getTime();
    return start >= wS && end <= wE;
  });
  const clinicOpenThatDay =
    !clinicHours.weeklyOffDays.includes(dow) &&
    !dayOffCovers(dayOffs, dateISO, tz, (d) => d.scope === 'CLINIC');
  if (clinicOpenThatDay && !coveredByDoctor) {
    conflicts.push({
      kind: 'SOFT',
      code: 'DOCTOR_OUTSIDE_AVAILABILITY',
      message: "Outside the doctor's working hours.",
    });
  }

  // SAME_PATIENT_SAME_DAY
  if (appt.patientId) {
    const sameDay = others.some(
      (a) => a.patientId === appt.patientId && localDateISO(a.startsAt, tz) === dateISO,
    );
    if (sameDay) {
      conflicts.push({
        kind: 'SOFT',
        code: 'SAME_PATIENT_SAME_DAY',
        message: 'The patient already has another appointment that day.',
      });
    }
  }

  return conflicts;
}
