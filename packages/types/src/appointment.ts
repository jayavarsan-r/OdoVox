import { z } from 'zod';
import {
  AppointmentStatus,
  DayOffScope,
  RecurringInterval,
  ReminderStatus,
  Timestamps,
} from './common.js';

const HHMM = z.string().regex(/^\d{2}:\d{2}$/, 'expected HH:mm');

// ===========================================================================
// Conflicts & slots (shared by the pure schedule logic and the API responses)
// ===========================================================================

export const Conflict = z.object({
  kind: z.enum(['HARD', 'SOFT']),
  code: z.string(),
  message: z.string(),
});
export type Conflict = z.infer<typeof Conflict>;

export const Slot = z.object({
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  doctorId: z.string(),
  roomId: z.string().nullable().optional(),
  warnings: z.array(z.string()).default([]),
});
export type Slot = z.infer<typeof Slot>;

// ===========================================================================
// Appointment CRUD
// ===========================================================================

export const CreateAppointmentInput = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  startsAt: z.coerce.date(), // clinic local time on the wire; server converts to UTC
  durationMinutes: z.number().int().min(5).max(600).default(30),
  roomId: z.string().min(1).optional(),
  procedureHint: z.string().max(160).optional(),
  notes: z.string().max(2000).optional(),
  treatmentPlanId: z.string().min(1).optional(),
  sittingNumber: z.number().int().min(1).optional(),
  acknowledgedSoftConflicts: z.array(z.string()).optional(),
});
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentInput>;

// Edit excluding time changes (those go through /reschedule for audit clarity).
export const UpdateAppointmentInput = z.object({
  roomId: z.string().min(1).nullable().optional(),
  procedureHint: z.string().max(160).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentInput>;

export const RescheduleAppointmentInput = z.object({
  newStartsAt: z.coerce.date(),
  newDurationMinutes: z.number().int().min(5).max(600).optional(),
  acknowledgedSoftConflicts: z.array(z.string()).optional(),
});
export type RescheduleAppointmentInput = z.infer<typeof RescheduleAppointmentInput>;

export const CancelAppointmentInput = z.object({
  reason: z.string().max(500).optional(),
  notifyPatient: z.boolean().optional(),
});
export type CancelAppointmentInput = z.infer<typeof CancelAppointmentInput>;

export const RecurringAppointmentInput = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  firstStartsAt: z.coerce.date(),
  durationMinutes: z.number().int().min(5).max(600).default(30),
  totalOccurrences: z.number().int().min(2).max(12),
  interval: RecurringInterval,
  procedureHint: z.string().max(160).optional(),
  treatmentPlanId: z.string().min(1).optional(),
  roomId: z.string().min(1).optional(),
  acknowledgedSoftConflicts: z.array(z.string()).optional(),
});
export type RecurringAppointmentInput = z.infer<typeof RecurringAppointmentInput>;

export const SeriesCancelInput = z
  .object({
    scope: z.enum(['THIS_ONLY', 'THIS_AND_FUTURE', 'ALL']),
    startingFromIndex: z.number().int().min(1).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((v) => v.scope === 'ALL' || v.startingFromIndex != null, {
    message: 'startingFromIndex is required for THIS_ONLY and THIS_AND_FUTURE',
    path: ['startingFromIndex'],
  });
export type SeriesCancelInput = z.infer<typeof SeriesCancelInput>;

export const AppointmentResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    patientId: z.string(),
    doctorId: z.string(),
    roomId: z.string().nullable(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    durationMinutes: z.number().int(),
    status: AppointmentStatus,
    procedureHint: z.string().nullable(),
    notes: z.string().nullable(),
    seriesId: z.string().nullable(),
    seriesIndex: z.number().int().nullable(),
    seriesTotal: z.number().int().nullable(),
    treatmentPlanId: z.string().nullable(),
    sittingNumber: z.number().int().nullable(),
    originalStartsAt: z.coerce.date().nullable(),
    rescheduleCount: z.number().int(),
    cancelledAt: z.coerce.date().nullable(),
    cancelledById: z.string().nullable(),
    cancellationReason: z.string().nullable(),
    noShowAt: z.coerce.date().nullable(),
    createdById: z.string(),
  })
  .merge(Timestamps);
export type AppointmentResponse = z.infer<typeof AppointmentResponse>;

// ===========================================================================
// Doctor availability (recurring weekly template)
// ===========================================================================

export const CreateDoctorAvailabilityInput = z
  .object({
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: HHMM,
    endTime: HHMM,
    effectiveFrom: z.coerce.date().nullable().optional(),
    effectiveTo: z.coerce.date().nullable().optional(),
  })
  .refine((v) => v.startTime < v.endTime, {
    message: 'startTime must be before endTime',
    path: ['endTime'],
  });
export type CreateDoctorAvailabilityInput = z.infer<typeof CreateDoctorAvailabilityInput>;

export const UpdateDoctorAvailabilityInput = z.object({
  startTime: HHMM.optional(),
  endTime: HHMM.optional(),
  effectiveFrom: z.coerce.date().nullable().optional(),
  effectiveTo: z.coerce.date().nullable().optional(),
});
export type UpdateDoctorAvailabilityInput = z.infer<typeof UpdateDoctorAvailabilityInput>;

export const DoctorAvailabilityResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    doctorId: z.string(),
    dayOfWeek: z.number().int(),
    startTime: z.string(),
    endTime: z.string(),
    effectiveFrom: z.coerce.date().nullable(),
    effectiveTo: z.coerce.date().nullable(),
  })
  .merge(Timestamps);
export type DoctorAvailabilityResponse = z.infer<typeof DoctorAvailabilityResponse>;

// ===========================================================================
// Day off
// ===========================================================================

export const CreateDayOffInput = z
  .object({
    date: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    scope: DayOffScope,
    doctorId: z.string().min(1).optional(),
    reason: z.string().max(500).optional(),
  })
  .refine((v) => v.scope !== 'DOCTOR' || !!v.doctorId, {
    message: 'doctorId is required when scope is DOCTOR',
    path: ['doctorId'],
  });
export type CreateDayOffInput = z.infer<typeof CreateDayOffInput>;

export const DayOffResponse = z.object({
  id: z.string(),
  clinicId: z.string(),
  date: z.coerce.date(),
  endDate: z.coerce.date().nullable(),
  scope: DayOffScope,
  doctorId: z.string().nullable(),
  reason: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
});
export type DayOffResponse = z.infer<typeof DayOffResponse>;

// ===========================================================================
// Reminders (Phase 6 inserts; Phase 9 sends)
// ===========================================================================

export const AppointmentReminderResponse = z.object({
  id: z.string(),
  clinicId: z.string(),
  appointmentId: z.string(),
  patientId: z.string(),
  scheduledFor: z.coerce.date(),
  channel: z.string(),
  template: z.string(),
  status: ReminderStatus,
  sentAt: z.coerce.date().nullable(),
  errorReason: z.string().nullable(),
});
export type AppointmentReminderResponse = z.infer<typeof AppointmentReminderResponse>;
