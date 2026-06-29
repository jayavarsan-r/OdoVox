import type { RecurringInterval } from '@odovox/types';
import { getAvailableSlots } from './availability.js';
import { localDateISO, utcToZonedParts } from './tz.js';
import {
  type AvailabilityWindow,
  type DayOffInput,
  type ExistingAppointment,
  type ScheduleClinicHours,
} from './types.js';

export interface AppointmentDraft {
  startsAt: Date;
  endsAt: Date;
  doctorId: string;
  roomId?: string | null;
  seriesIndex: number; // 1-based
}

export interface GenerateRecurringInput {
  firstStartsAt: Date;
  durationMinutes: number;
  totalOccurrences: number; // 2-12 typical
  interval: RecurringInterval;
  doctorId: string;
  doctorAvailability: AvailabilityWindow[];
  clinicHours: ScheduleClinicHours;
  dayOffs: DayOffInput[];
  existingAppointments: ExistingAppointment[];
  bufferMinutes?: number;
  slotGranularityMinutes?: number;
}

export interface GenerateRecurringResult {
  plan: AppointmentDraft[];
  unscheduled: Array<{ index: number; reason: string }>;
}

const MAX_LOOKAHEAD_DAYS = 7;

function fmtUTC(dt: Date): string {
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function addDaysISO(dateISO: string, n: number): string {
  const p = dateISO.split('-');
  return fmtUTC(new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n)));
}

function addMonthsISO(dateISO: string, n: number): string {
  const p = dateISO.split('-');
  return fmtUTC(new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1 + n, Number(p[2]))));
}

/** Target calendar date for occurrence `i` (0-based) given the interval. */
function targetDateISO(baseISO: string, interval: RecurringInterval, i: number): string {
  switch (interval) {
    case 'WEEKLY':
      return addDaysISO(baseISO, 7 * i);
    case 'BIWEEKLY':
      return addDaysISO(baseISO, 14 * i);
    case 'MONTHLY':
      return addMonthsISO(baseISO, i);
  }
}

/**
 * Plan a recurring series. For each occurrence we look for the first available slot on the target
 * date, then up to 7 days forward; occurrences that can't be placed are returned as `unscheduled`.
 * Each placed occurrence is fed back into the working set so later ones don't collide with it.
 * Pure: no DB, no clock. Spec §2.3.
 */
export function generateRecurringSeries(input: GenerateRecurringInput): GenerateRecurringResult {
  const {
    firstStartsAt,
    durationMinutes,
    totalOccurrences,
    interval,
    doctorId,
    doctorAvailability,
    clinicHours,
    dayOffs,
    existingAppointments,
    bufferMinutes = 5,
    slotGranularityMinutes = 15,
  } = input;
  const tz = clinicHours.timezone;

  const baseISO = localDateISO(firstStartsAt, tz);
  const firstParts = utcToZonedParts(firstStartsAt, tz);
  const preferredHHMM = `${String(firstParts.hour).padStart(2, '0')}:${String(firstParts.minute).padStart(2, '0')}`;

  const plan: AppointmentDraft[] = [];
  const unscheduled: Array<{ index: number; reason: string }> = [];
  // Mutable working set — placed occurrences become "busy" for subsequent ones.
  const working: ExistingAppointment[] = [...existingAppointments];

  for (let i = 0; i < totalOccurrences; i++) {
    const wantedISO = targetDateISO(baseISO, interval, i);
    let placed: AppointmentDraft | null = null;

    for (let look = 0; look <= MAX_LOOKAHEAD_DAYS && !placed; look++) {
      const dISO = addDaysISO(wantedISO, look);
      const slots = getAvailableSlots({
        dateISO: dISO,
        doctorId,
        doctorAvailability,
        clinicHours,
        dayOffs,
        existingAppointments: working,
        durationMinutes,
        bufferMinutes,
        slotGranularityMinutes,
      });
      // Prefer the slot at the originally-requested time-of-day; else the first free slot.
      const chosen =
        slots.find((s) => {
          const p = utcToZonedParts(s.startsAt, tz);
          return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}` === preferredHHMM;
        }) ?? slots[0];
      if (!chosen) continue;
      placed = {
        startsAt: chosen.startsAt,
        endsAt: chosen.endsAt,
        doctorId,
        roomId: chosen.roomId ?? null,
        seriesIndex: i + 1,
      };
    }

    if (placed) {
      plan.push(placed);
      working.push({
        id: `__series_${i + 1}`,
        doctorId,
        roomId: placed.roomId,
        startsAt: placed.startsAt,
        endsAt: placed.endsAt,
        status: 'SCHEDULED',
      });
    } else {
      unscheduled.push({
        index: i + 1,
        reason: `No available slot within ${MAX_LOOKAHEAD_DAYS} days of ${wantedISO}`,
      });
    }
  }

  return { plan, unscheduled };
}
