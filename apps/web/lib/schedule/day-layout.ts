import type { ScheduleAppointment } from '@odovox/types';
import { hhmmToMinutes, localDateISO, localDayOfWeek, localMinutesOfDay, dayOfWeekOfISO } from './tz.js';
import { procedureTone, type ProcedureTone } from './format.js';

export interface ClinicHoursLite {
  open: string; // "09:00"
  close: string; // "18:00"
  lunchStart?: string | null;
  lunchEnd?: string | null;
  weeklyOffDays: number[];
  timezone: string;
}

export interface PositionedBlock {
  id: string;
  appt: ScheduleAppointment;
  topMinutes: number; // minutes from clinic open
  heightMinutes: number;
  tone: ProcedureTone;
}

export interface DayLayout {
  isOffDay: boolean;
  openMinutes: number;
  closeMinutes: number;
  totalMinutes: number;
  hourMarks: Array<{ minutesFromOpen: number; label: string }>;
  lunch: { topMinutes: number; heightMinutes: number } | null;
  nowLineMinutes: number | null;
  blocks: PositionedBlock[];
}

function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${hour < 12 || hour === 24 ? 'AM' : 'PM'}`;
}

const VISIBLE = new Set(['SCHEDULED', 'CHECKED_IN', 'COMPLETED']);

/**
 * Compute the doctor day-view layout for one clinic-local date. Pure: positions are minutes from
 * clinic open; the component scales by px/minute. Off days / day-offs are signalled via `isOffDay`
 * (the caller decides that from weeklyOffDays + DayOff data) — here we only flag the weekly-off case.
 */
export function buildDayLayout(input: {
  dateISO: string;
  clinicHours: ClinicHoursLite;
  appointments: ScheduleAppointment[];
  now?: Date;
  forcedOffDay?: boolean; // a DayOff covers this date
}): DayLayout {
  const { dateISO, clinicHours, appointments, forcedOffDay } = input;
  const tz = clinicHours.timezone;
  const openMinutes = hhmmToMinutes(clinicHours.open);
  const closeMinutes = hhmmToMinutes(clinicHours.close);
  const totalMinutes = Math.max(0, closeMinutes - openMinutes);
  const dow = dayOfWeekOfISO(dateISO);
  const isOffDay = !!forcedOffDay || clinicHours.weeklyOffDays.includes(dow);

  const hourMarks: DayLayout['hourMarks'] = [];
  for (let h = Math.ceil(openMinutes / 60); h * 60 <= closeMinutes; h++) {
    hourMarks.push({ minutesFromOpen: h * 60 - openMinutes, label: hourLabel(h) });
  }

  let lunch: DayLayout['lunch'] = null;
  if (clinicHours.lunchStart && clinicHours.lunchEnd) {
    const ls = hhmmToMinutes(clinicHours.lunchStart);
    const le = hhmmToMinutes(clinicHours.lunchEnd);
    lunch = { topMinutes: ls - openMinutes, heightMinutes: Math.max(0, le - ls) };
  }

  const now = input.now ?? new Date();
  const nowLineMinutes =
    localDateISO(now, tz) === dateISO && localDayOfWeek(now, tz) === dow
      ? clampNow(localMinutesOfDay(now, tz) - openMinutes, totalMinutes)
      : null;

  const blocks: PositionedBlock[] = appointments
    .filter((a) => VISIBLE.has(a.status))
    .filter((a) => localDateISO(new Date(a.startsAt), tz) === dateISO)
    .map((a) => {
      const startMin = localMinutesOfDay(new Date(a.startsAt), tz);
      return {
        id: a.id,
        appt: a,
        topMinutes: startMin - openMinutes,
        heightMinutes: Math.max(15, a.durationMinutes),
        tone: procedureTone(a.procedureHint),
      };
    })
    .sort((x, y) => x.topMinutes - y.topMinutes);

  return { isOffDay, openMinutes, closeMinutes, totalMinutes, hourMarks, lunch, nowLineMinutes, blocks };
}

function clampNow(v: number, total: number): number | null {
  return v >= 0 && v <= total ? v : null;
}
