import { z } from 'zod';
import { AppointmentStatus, AvailabilityType, Timestamps } from './common.js';

export const CreateAppointmentInput = z.object({
  patientId: z.string().min(1),
  doctorId: z.string().min(1),
  procedureType: z.string().min(1).max(160),
  scheduledAt: z.coerce.date(),
  durationMinutes: z.number().int().min(5).max(600).default(30),
  notes: z.string().max(2000).optional(),
});
export type CreateAppointmentInput = z.infer<typeof CreateAppointmentInput>;

export const UpdateAppointmentInput = CreateAppointmentInput.partial()
  .omit({ patientId: true })
  .extend({
    status: AppointmentStatus.optional(),
    parentAppointmentId: z.string().min(1).nullable().optional(),
  });
export type UpdateAppointmentInput = z.infer<typeof UpdateAppointmentInput>;

export const AppointmentResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    patientId: z.string(),
    doctorId: z.string(),
    procedureType: z.string(),
    scheduledAt: z.coerce.date(),
    durationMinutes: z.number().int(),
    status: AppointmentStatus,
    notes: z.string().nullable(),
    parentAppointmentId: z.string().nullable(),
  })
  .merge(Timestamps);
export type AppointmentResponse = z.infer<typeof AppointmentResponse>;

export const CreateDoctorAvailabilityInput = z.object({
  doctorId: z.string().min(1),
  date: z.coerce.date(),
  type: AvailabilityType,
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  reason: z.string().max(500).optional(),
});
export type CreateDoctorAvailabilityInput = z.infer<typeof CreateDoctorAvailabilityInput>;

export const DoctorAvailabilityResponse = z
  .object({
    id: z.string(),
    doctorId: z.string(),
    date: z.coerce.date(),
    type: AvailabilityType,
    startTime: z.string().nullable(),
    endTime: z.string().nullable(),
    reason: z.string().nullable(),
  })
  .merge(Timestamps);
export type DoctorAvailabilityResponse = z.infer<typeof DoctorAvailabilityResponse>;
