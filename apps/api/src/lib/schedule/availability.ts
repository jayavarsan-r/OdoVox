import type { Slot } from '@odovox/types';
import { localDateISO, localDateTimeToUtc, dayOfWeekOf } from './tz.js';
import {
  type AvailabilityWindow,
  type DayOffInput,
  type GetAvailableSlotsInput,
  type ScheduleClinicHours,
  OCCUPYING_STATUSES,
} from './types.js';

const MINUTE_MS = 60_000;

interface Interval {
  start: number; // epoch ms
  end: number;
}

/** Does any DayOff (of the given scope predicate) cover `dateISO`? Compared by clinic-local day. */
export function dayOffCovers(
  dayOffs: DayOffInput[],
  dateISO: string,
  tz: string,
  match: (d: DayOffInput) => boolean,
): boolean {
  for (const d of dayOffs) {
    if (!match(d)) continue;
    const fromISO = localDateISO(d.date, tz);
    const toISO = d.endDate ? localDateISO(d.endDate, tz) : fromISO;
    if (dateISO >= fromISO && dateISO <= toISO) return true;
  }
  return false;
}

/** Intersection of two [start,end] intervals, or null if they don't overlap. */
function intersect(a: Interval, b: Interval): Interval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return start < end ? { start, end } : null;
}

/** Subtract `cut` from `iv`, returning 0-2 remaining intervals. */
function subtract(iv: Interval, cut: Interval): Interval[] {
  const overlap = intersect(iv, cut);
  if (!overlap) return [iv];
  const out: Interval[] = [];
  if (iv.start < overlap.start) out.push({ start: iv.start, end: overlap.start });
  if (overlap.end < iv.end) out.push({ start: overlap.end, end: iv.end });
  return out;
}

/** Is a weekly window in effect on the given local day-start instant? */
function windowInEffect(w: AvailabilityWindow, dayStartUtc: Date): boolean {
  if (w.effectiveFrom && dayStartUtc < w.effectiveFrom) return false;
  if (w.effectiveTo && dayStartUtc > w.effectiveTo) return false;
  return true;
}

/**
 * Returns ordered free slots that fit `durationMinutes` for one doctor on one clinic-local day.
 * Pure: no DB, no clock. Rule order matches the Phase 6 spec §2.1 exactly.
 */
export function getAvailableSlots(input: GetAvailableSlotsInput): Slot[] {
  const {
    dateISO,
    doctorId,
    doctorAvailability,
    clinicHours,
    dayOffs,
    existingAppointments,
    durationMinutes,
    bufferMinutes = 5,
    slotGranularityMinutes = 15,
  } = input;
  const tz = clinicHours.timezone;
  const dow = dayOfWeekOf(dateISO, tz);

  // 1. Clinic weekly-off day → no slots.
  if (clinicHours.weeklyOffDays.includes(dow)) return [];
  // 2. Clinic-scope DayOff covers the date → no slots.
  if (dayOffCovers(dayOffs, dateISO, tz, (d) => d.scope === 'CLINIC')) return [];
  // 3. Doctor-scope DayOff for this doctor → no slots for that doctor.
  if (dayOffCovers(dayOffs, dateISO, tz, (d) => d.scope === 'DOCTOR' && d.doctorId === doctorId))
    return [];

  const dayStartUtc = localDateTimeToUtc(dateISO, '00:00', tz);
  const clinicEnvelope: Interval = {
    start: localDateTimeToUtc(dateISO, clinicHours.open, tz).getTime(),
    end: localDateTimeToUtc(dateISO, clinicHours.close, tz).getTime(),
  };

  // 4. Doctor's working windows for this dayOfWeek, intersected with clinic hours.
  // Phase 9.6 Issue 10.2: a doctor with NO configured availability works the clinic's open
  // hours. Most small clinics never fill in weekly windows — without this default, "Schedule
  // all" 409s on every plan (manual booking already allows it as a SOFT conflict; slot search
  // must agree).
  const doctorRows = doctorAvailability.filter((w) => w.doctorId === doctorId);
  let windows: Interval[] = [];
  if (doctorRows.length === 0) {
    windows = [clinicEnvelope];
  } else {
    for (const w of doctorRows) {
      if (w.dayOfWeek !== dow) continue;
      if (!windowInEffect(w, dayStartUtc)) continue;
      const win: Interval = {
        start: localDateTimeToUtc(dateISO, w.startTime, tz).getTime(),
        end: localDateTimeToUtc(dateISO, w.endTime, tz).getTime(),
      };
      const clipped = intersect(win, clinicEnvelope);
      if (clipped) windows.push(clipped);
    }
  }
  if (windows.length === 0) return [];

  // 5. Subtract the clinic lunch break.
  if (clinicHours.lunchStart && clinicHours.lunchEnd) {
    const lunch: Interval = {
      start: localDateTimeToUtc(dateISO, clinicHours.lunchStart, tz).getTime(),
      end: localDateTimeToUtc(dateISO, clinicHours.lunchEnd, tz).getTime(),
    };
    windows = windows.flatMap((w) => subtract(w, lunch));
  }
  windows.sort((a, b) => a.start - b.start);

  // Busy intervals: this doctor's occupying appointments, expanded by the buffer on both sides.
  const bufferMs = bufferMinutes * MINUTE_MS;
  const busy: Interval[] = existingAppointments
    .filter((a) => a.doctorId === doctorId && OCCUPYING_STATUSES.has(a.status))
    .map((a) => ({ start: a.startsAt.getTime() - bufferMs, end: a.endsAt.getTime() + bufferMs }));

  // 6. Walk the slot grid.
  const durationMs = durationMinutes * MINUTE_MS;
  const stepMs = slotGranularityMinutes * MINUTE_MS;
  const slots: Slot[] = [];
  for (const w of windows) {
    for (let s = w.start; s + durationMs <= w.end; s += stepMs) {
      const e = s + durationMs;
      const overlapsBusy = busy.some((b) => s < b.end && e > b.start);
      if (overlapsBusy) continue;
      slots.push({
        startsAt: new Date(s),
        endsAt: new Date(e),
        doctorId,
        roomId: null,
        warnings: [],
      });
    }
  }
  return slots;
}

export type { GetAvailableSlotsInput, ScheduleClinicHours };
