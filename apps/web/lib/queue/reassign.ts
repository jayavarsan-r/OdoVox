import type { QueueDoctor, VisitWithPatient } from '@odovox/types';
import { queueDoctorId } from './selectors';

export type Role = 'DOCTOR' | 'RECEPTIONIST' | 'ADMIN';

/** Only the receptionist/admin manage assignment + priority (the doctor works their own queue). */
export function canManageQueue(role: Role): boolean {
  return role === 'RECEPTIONIST' || role === 'ADMIN';
}

/** A visit can be reassigned/reprioritised only while it is still in the waiting part of the flow. */
export function canReassign(visit: VisitWithPatient): boolean {
  return visit.status === 'WAITING' || visit.status === 'CHECKED_IN' || visit.status === 'SCHEDULED';
}

/** The action-sheet options for a long-pressed waiting patient, given the viewer's role. */
export function reassignActions(role: Role, visit: VisitWithPatient): Array<'reassign' | 'bump' | 'lower' | 'cancel'> {
  if (!canManageQueue(role) || !canReassign(visit)) return [];
  return ['reassign', 'bump', 'lower', 'cancel'];
}

/** Reassign targets = every other doctor in the clinic (can't reassign to the current owner). */
export function reassignTargets(doctors: QueueDoctor[], visit: VisitWithPatient): QueueDoctor[] {
  const current = queueDoctorId(visit);
  return doctors.filter((d) => d.id !== current);
}

export const PRIORITY_STEP = 10;

/** Bump = +10 (sooner), lower = -10. */
export function nextPriority(current: number, direction: 'bump' | 'lower'): number {
  return direction === 'bump' ? current + PRIORITY_STEP : current - PRIORITY_STEP;
}
