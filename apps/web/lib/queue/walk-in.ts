import type { CreateWalkInInput, QueueDoctor } from '@odovox/types';

/** Shape the walk-in sheet's selections into the POST /visits body. */
export function buildWalkInBody(input: {
  patientId: string;
  doctorId: string;
  chiefComplaint?: string;
  priority?: number;
  appointmentId?: string;
}): CreateWalkInInput {
  return {
    patientId: input.patientId,
    doctorId: input.doctorId,
    priority: input.priority ?? 0,
    ...(input.chiefComplaint?.trim() ? { chiefComplaint: input.chiefComplaint.trim() } : {}),
    ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}),
  };
}

export interface DoctorChoice {
  id: string;
  name: string;
  waiting: number;
  available: boolean;
}

/** Doctor picker: least-loaded available doctors first ("Dr. Asha — 2 waiting"). */
export function doctorChoices(
  doctors: QueueDoctor[],
  waitingCounts: Map<string, number>,
): DoctorChoice[] {
  return doctors
    .map((d) => ({ id: d.id, name: d.name, waiting: waitingCounts.get(d.id) ?? 0, available: d.available }))
    .sort((a, b) => {
      if (a.available !== b.available) return a.available ? -1 : 1; // available first
      if (a.waiting !== b.waiting) return a.waiting - b.waiting; // then least loaded
      return a.name.localeCompare(b.name);
    });
}

/** If a single doctor works the clinic, default to them without asking (§2.2 multi-doctor rule). */
export function defaultDoctorId(doctors: QueueDoctor[]): string | null {
  const available = doctors.filter((d) => d.available);
  if (available.length === 1) return available[0]!.id;
  if (doctors.length === 1) return doctors[0]!.id;
  return null;
}
