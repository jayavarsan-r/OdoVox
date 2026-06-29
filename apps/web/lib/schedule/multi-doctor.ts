import type { ScheduleAppointment } from '@odovox/types';

export interface DoctorColumn {
  doctorId: string;
  name: string;
  count: number; // non-cancelled appointments that day
}

/**
 * Derive the ordered doctor columns for the receptionist multi-doctor day view (§7.2): the union of
 * known clinic doctors and any doctor with an appointment that day, ordered by name, each with its
 * active appointment count.
 */
export function deriveDoctorColumns(
  appointments: ScheduleAppointment[],
  knownDoctors: Array<{ id: string; name: string }>,
): DoctorColumn[] {
  const names = new Map<string, string>();
  for (const d of knownDoctors) names.set(d.id, d.name);
  for (const a of appointments) if (a.doctorName && !names.has(a.doctorId)) names.set(a.doctorId, a.doctorName);

  const active = appointments.filter((a) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW');
  return [...names.entries()]
    .map(([doctorId, name]) => ({ doctorId, name, count: active.filter((a) => a.doctorId === doctorId).length }))
    .sort((x, y) => x.name.localeCompare(y.name));
}

/** Appointments for a single doctor (used to feed buildDayLayout per column). */
export function appointmentsForDoctor(appointments: ScheduleAppointment[], doctorId: string): ScheduleAppointment[] {
  return appointments.filter((a) => a.doctorId === doctorId);
}
