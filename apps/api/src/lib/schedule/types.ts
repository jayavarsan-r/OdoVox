import type { Slot } from '@odovox/types';

export type { Conflict, Slot } from '@odovox/types';

/** Clinic working envelope + timezone. Doctor availability narrows this; it never widens it. */
export interface ScheduleClinicHours {
  open: string; // "09:00"
  close: string; // "18:00"
  lunchStart?: string | null;
  lunchEnd?: string | null;
  weeklyOffDays: number[]; // 0 = Sun .. 6 = Sat
  timezone: string;
}

/** One recurring weekly availability window for a doctor (decoupled from the Prisma row). */
export interface AvailabilityWindow {
  doctorId: string;
  dayOfWeek: number; // 0 = Sun .. 6 = Sat
  startTime: string; // "09:00"
  endTime: string; // "18:00"
  effectiveFrom?: Date | null;
  effectiveTo?: Date | null;
}

/** A one-off block (holiday / leave / closure). */
export interface DayOffInput {
  date: Date; // first blocked clinic-local day
  endDate?: Date | null; // last blocked day (inclusive); null = single day
  scope: 'CLINIC' | 'DOCTOR';
  doctorId?: string | null;
}

/** Minimal shape the engine needs from an existing appointment. */
export interface ExistingAppointment {
  id: string;
  doctorId: string;
  roomId?: string | null;
  patientId?: string;
  startsAt: Date;
  endsAt: Date;
  status: string; // only SCHEDULED | CHECKED_IN occupy the calendar
}

/** Statuses that occupy a calendar slot (everything else is free). */
export const OCCUPYING_STATUSES = new Set(['SCHEDULED', 'CHECKED_IN']);

export interface GetAvailableSlotsInput {
  dateISO: string; // clinic-local calendar day, YYYY-MM-DD
  doctorId: string;
  doctorAvailability: AvailabilityWindow[];
  clinicHours: ScheduleClinicHours;
  dayOffs: DayOffInput[];
  existingAppointments: ExistingAppointment[];
  durationMinutes: number;
  bufferMinutes?: number; // default 5
  slotGranularityMinutes?: number; // default 15
}

export type { Slot as ScheduleSlot };
export type SlotList = Slot[];
