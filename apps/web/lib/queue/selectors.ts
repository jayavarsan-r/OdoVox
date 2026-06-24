import type { VisitWithPatient } from '@odovox/types';
import type { QueueState } from './reducer';

/** Whose queue a visit sits in (assigned doctor wins; falls back to the treating doctor). */
export function queueDoctorId(v: VisitWithPatient): string {
  return v.assignedDoctorId ?? v.doctorId;
}

function ms(d: Date | string | null): number {
  if (!d) return Number.POSITIVE_INFINITY; // nulls sort last
  return new Date(d).getTime();
}

/** Waiting order: priority desc, then earliest check-in, then earliest created (stable FIFO). */
export function compareWaiting(a: VisitWithPatient, b: VisitWithPatient): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  const ci = ms(a.checkedInAt) - ms(b.checkedInAt);
  if (ci !== 0) return ci;
  return ms(a.createdAt) - ms(b.createdAt);
}

function values(state: QueueState): VisitWithPatient[] {
  return Array.from(state.visits.values());
}

export function getAll(state: QueueState): VisitWithPatient[] {
  return values(state);
}

export function getWaiting(state: QueueState, forDoctorId?: string): VisitWithPatient[] {
  return values(state)
    .filter((v) => v.status === 'WAITING' && (!forDoctorId || queueDoctorId(v) === forDoctorId))
    .sort(compareWaiting);
}

export function getInChair(state: QueueState, forDoctorId?: string): VisitWithPatient | null {
  const inChair = values(state).filter(
    (v) => v.status === 'IN_CHAIR' && (!forDoctorId || queueDoctorId(v) === forDoctorId),
  );
  // Most recently called-in first (a doctor has at most one, but be defensive).
  inChair.sort((a, b) => ms(b.calledInAt) - ms(a.calledInAt));
  return inChair[0] ?? null;
}

export function getCheckout(state: QueueState, forDoctorId?: string): VisitWithPatient[] {
  return values(state)
    .filter((v) => v.status === 'CHECKOUT' && (!forDoctorId || queueDoctorId(v) === forDoctorId))
    .sort((a, b) => ms(a.checkoutStartedAt) - ms(b.checkoutStartedAt));
}

export interface DoctorQueue {
  doctorId: string;
  doctorName: string | null;
  available: boolean;
  inChair: VisitWithPatient | null;
  waiting: VisitWithPatient[];
}

/** Per-doctor grouping for the receptionist's "Active queue" sections. */
export function getByDoctor(state: QueueState): DoctorQueue[] {
  return state.doctors.map((d) => ({
    doctorId: d.id,
    doctorName: d.name,
    available: d.available,
    inChair: getInChair(state, d.id),
    waiting: getWaiting(state, d.id),
  }));
}

/** Count waiting in a doctor's queue — used by the "assign to doctor" picker ("Dr. Asha — 2 waiting"). */
export function waitingCountByDoctor(state: QueueState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const v of values(state)) {
    if (v.status !== 'WAITING') continue;
    const id = queueDoctorId(v);
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}
