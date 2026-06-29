import { type Prisma, type VisitStatus } from '@odovox/db';
import type { QueueSnapshot, VisitWithPatient } from '@odovox/types';
import { runWithContext } from '../request-context.js';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';

/** Non-terminal visits make up the live queue. */
export const ACTIVE_QUEUE_STATES: VisitStatus[] = [
  'SCHEDULED',
  'CHECKED_IN',
  'WAITING',
  'IN_CHAIR',
  'CHECKOUT',
];

/**
 * The include every queue read uses. `select`s keep the payload lean and — importantly — keep the
 * consultation's `structuredData`/transcript OUT of the queue row (receptionists read the queue).
 */
export const VISIT_QUEUE_INCLUDE = {
  patient: {
    select: { id: true, name: true, age: true, patientCode: true, phone: true, medicalFlags: true },
  },
  doctor: { select: { id: true, name: true } },
  assignedDoctor: { select: { id: true, name: true } },
  room: { select: { id: true, name: true, number: true } },
  consultation: { select: { id: true, status: true } },
  bills: { where: { deletedAt: null }, select: { totalPaise: true, paidPaise: true } },
} satisfies Prisma.VisitInclude;

type QueueVisitRow = Prisma.VisitGetPayload<{ include: typeof VISIT_QUEUE_INCLUDE }>;

export interface SnapshotOptions {
  /** Visit ids currently being recorded into (ephemeral; tracked in Redis by the socket layer). */
  recordingVisitIds?: ReadonlySet<string>;
}

/** Map a Prisma visit (with queue includes) to the wire shape the store/UI consume. */
export function serializeQueueVisit(v: QueueVisitRow, recording = false): VisitWithPatient {
  const billTotalPaise = v.bills.length ? v.bills.reduce((s, b) => s + b.totalPaise, 0) : null;
  const billDuePaise = v.bills.length
    ? v.bills.reduce((s, b) => s + (b.totalPaise - b.paidPaise), 0)
    : null;
  return {
    id: v.id,
    clinicId: v.clinicId,
    status: v.status,
    tokenNumber: v.tokenNumber,
    priority: v.priority,
    lifecycleVersion: v.lifecycleVersion,
    chiefComplaint: v.chiefComplaint ?? null,
    assignedDoctorId: v.assignedDoctorId ?? null,
    doctorId: v.doctorId,
    doctorName: v.assignedDoctor?.name ?? v.doctor?.name ?? null,
    roomId: v.roomId ?? null,
    roomName: v.room?.name ?? null,
    patient: {
      id: v.patient.id,
      name: v.patient.name,
      age: v.patient.age,
      patientCode: v.patient.patientCode,
      phone: v.patient.phone,
      medicalFlags: v.patient.medicalFlags,
    },
    consultationId: v.consultation?.id ?? null,
    consultationStatus: v.consultation?.status ?? null,
    recording,
    billTotalPaise,
    billDuePaise,
    checkedInAt: v.checkedInAt ?? null,
    calledInAt: v.calledInAt ?? null,
    checkoutStartedAt: v.checkoutStartedAt ?? null,
    createdAt: v.createdAt,
  };
}

/** Reload one visit with full queue context — used to build a broadcast payload after a commit. */
export async function loadQueueVisit(
  prisma: ExtendedPrismaClient,
  clinicId: string,
  visitId: string,
  opts: SnapshotOptions = {},
): Promise<VisitWithPatient | null> {
  return runWithContext({ clinicId }, async () => {
    const v = await prisma.visit.findFirst({ where: { id: visitId }, include: VISIT_QUEUE_INCLUDE });
    if (!v) return null;
    return serializeQueueVisit(v, opts.recordingVisitIds?.has(v.id) ?? false);
  });
}

/**
 * Full current queue state for a clinic. Runs inside a clinic-scoped context so it is safe to call
 * from the socket connection handler (which has no Fastify request context) as well as from routes.
 * Cache this in Redis for ~1s upstream to dedupe rapid reconnects (the socket layer does so).
 */
export async function getQueueSnapshot(
  prisma: ExtendedPrismaClient,
  clinicId: string,
  opts: SnapshotOptions = {},
): Promise<QueueSnapshot> {
  return runWithContext({ clinicId }, async () => {
    const [visits, members, rooms, offToday] = await Promise.all([
      prisma.visit.findMany({
        where: { status: { in: ACTIVE_QUEUE_STATES }, deletedAt: null },
        include: VISIT_QUEUE_INCLUDE,
        orderBy: [{ priority: 'desc' }, { checkedInAt: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.clinicMember.findMany({
        where: { role: 'DOCTOR', status: 'ACTIVE', deletedAt: null },
        include: { user: { select: { id: true, name: true } } },
      }),
      prisma.room.findMany({
        where: { deletedAt: null },
        select: { id: true, name: true, number: true, status: true },
        orderBy: { number: 'asc' },
      }),
      doctorsOffToday(prisma),
    ]);

    const recording = opts.recordingVisitIds;
    return {
      visits: visits.map((v) => serializeQueueVisit(v, recording?.has(v.id) ?? false)),
      doctors: members.map((m) => ({
        id: m.user.id,
        name: m.user.name,
        available: !offToday.has(m.user.id),
      })),
      rooms,
      serverTime: new Date(),
    };
  });
}

/** Doctor ids with a DOCTOR-scope DayOff covering today (Phase 6 owns scheduling; we just read it). */
async function doctorsOffToday(prisma: ExtendedPrismaClient): Promise<Set<string>> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  // A DayOff covers today if its [date, endDate ?? date] range includes today. Scoped per doctor;
  // off-clinic doctors don't appear in the snapshot's doctor list anyway, so leakage is moot.
  const rows = await prisma.dayOff.findMany({
    where: {
      scope: 'DOCTOR',
      date: { lte: end },
      OR: [{ endDate: null, date: { gte: start } }, { endDate: { gte: start } }],
    },
    select: { doctorId: true },
  });
  return new Set(rows.map((r) => r.doctorId).filter((id): id is string => id != null));
}
