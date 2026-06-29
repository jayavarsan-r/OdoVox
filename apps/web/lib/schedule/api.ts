'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AppointmentReminderResponse,
  CancelAppointmentInput,
  CreateAppointmentInput,
  CreateDayOffInput,
  CreateDoctorAvailabilityInput,
  DayOffResponse,
  DoctorAvailabilityResponse,
  RecurringAppointmentInput,
  RescheduleAppointmentInput,
  ScheduleAppointment,
  Slot,
} from '@odovox/types';
import { api } from '../api-client';

export interface ScheduleResponse {
  appointments: ScheduleAppointment[];
  availability: Array<{ id: string; doctorId: string; dayOfWeek: number; startTime: string; endTime: string }>;
  dayOffs: Array<{ id: string; date: string; endDate: string | null; scope: string; doctorId: string | null; reason: string | null }>;
  clinicHours: { open: string; close: string; lunchStart: string | null; lunchEnd: string | null; weeklyOffDays: number[]; timezone: string };
}

export const scheduleKey = (from: string, to: string, doctorId: string) => ['schedule', from, to, doctorId];

export function useSchedule(from: string, to: string, doctorId: string) {
  return useQuery({
    queryKey: scheduleKey(from, to, doctorId),
    queryFn: () => api.get<ScheduleResponse>(`/schedule?from=${from}&to=${to}&doctorId=${doctorId}&view=day`),
    staleTime: 5_000,
  });
}

export function useSlots(date: string, doctorId: string, durationMinutes: number, enabled = true) {
  return useQuery({
    queryKey: ['schedule-slots', date, doctorId, durationMinutes],
    enabled: enabled && !!date && !!doctorId,
    queryFn: () => api.get<{ slots: Slot[] }>(`/schedule/slots?date=${date}&doctorId=${doctorId}&durationMinutes=${durationMinutes}`),
  });
}

function invalidateSchedule(qc: ReturnType<typeof useQueryClient>) {
  void qc.invalidateQueries({ queryKey: ['schedule'] });
  void qc.invalidateQueries({ queryKey: ['schedule-slots'] });
}

export function useCreateAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateAppointmentInput) => api.post<{ appointment: ScheduleAppointment; conflicts: unknown[] }>('/appointments', body),
    onSuccess: () => invalidateSchedule(qc),
  });
}

export function useRescheduleAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RescheduleAppointmentInput }) =>
      api.post<{ appointment: ScheduleAppointment }>(`/appointments/${id}/reschedule`, body),
    onSuccess: () => invalidateSchedule(qc),
  });
}

export function useCancelAppointment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: CancelAppointmentInput }) =>
      api.post<{ appointment: ScheduleAppointment }>(`/appointments/${id}/cancel`, body),
    onSuccess: () => invalidateSchedule(qc),
  });
}

export function useCreateRecurring() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: RecurringAppointmentInput) =>
      api.post<{ seriesId: string; appointments: ScheduleAppointment[] }>('/appointments/recurring', body),
    onSuccess: () => invalidateSchedule(qc),
  });
}

// ── Availability + day-off (Stage 6 settings pages) ─────────────────────────────────────────────
export function useDoctorAvailability(doctorId: string) {
  return useQuery({
    queryKey: ['availability', doctorId],
    enabled: !!doctorId,
    queryFn: () => api.get<{ availability: DoctorAvailabilityResponse[] }>(`/availability/doctor/${doctorId}`),
  });
}

export function useCreateAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ doctorId, body }: { doctorId: string; body: CreateDoctorAvailabilityInput }) =>
      api.post<{ availability: DoctorAvailabilityResponse }>(`/availability/doctor/${doctorId}`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}

export function useDeleteAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/availability/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['availability'] }),
  });
}

export function useDayOffs() {
  return useQuery({ queryKey: ['day-off'], queryFn: () => api.get<{ dayOffs: DayOffResponse[] }>('/day-off') });
}

export function useCreateDayOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateDayOffInput) => api.post<{ dayOff: DayOffResponse }>('/day-off', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['day-off'] });
      void qc.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}

export function useDeleteDayOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/day-off/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['day-off'] });
      void qc.invalidateQueries({ queryKey: ['schedule'] });
    },
  });
}

export type { AppointmentReminderResponse };
