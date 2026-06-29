import type { ScheduleAppointment } from '@odovox/types';

/** The Prisma include shape every schedule serialization needs. */
export const APPOINTMENT_INCLUDE = {
  patient: { select: { id: true, name: true } },
  doctor: { select: { id: true, name: true } },
  room: { select: { id: true, name: true } },
} as const;

interface AppointmentRow {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  roomId: string | null;
  startsAt: Date;
  endsAt: Date;
  durationMinutes: number;
  status: ScheduleAppointment['status'];
  procedureHint: string | null;
  notes: string | null;
  seriesId: string | null;
  seriesIndex: number | null;
  seriesTotal: number | null;
  treatmentPlanId: string | null;
  sittingNumber: number | null;
  originalStartsAt: Date | null;
  rescheduleCount: number;
  patient: { name: string } | null;
  doctor: { name: string } | null;
  room: { name: string } | null;
}

export function serializeAppointment(a: AppointmentRow): ScheduleAppointment {
  return {
    id: a.id,
    clinicId: a.clinicId,
    patientId: a.patientId,
    patientName: a.patient?.name ?? '—',
    doctorId: a.doctorId,
    doctorName: a.doctor?.name ?? null,
    roomId: a.roomId,
    roomName: a.room?.name ?? null,
    startsAt: a.startsAt,
    endsAt: a.endsAt,
    durationMinutes: a.durationMinutes,
    status: a.status,
    procedureHint: a.procedureHint,
    notes: a.notes,
    seriesId: a.seriesId,
    seriesIndex: a.seriesIndex,
    seriesTotal: a.seriesTotal,
    treatmentPlanId: a.treatmentPlanId,
    sittingNumber: a.sittingNumber,
    originalStartsAt: a.originalStartsAt,
    rescheduleCount: a.rescheduleCount,
  };
}
