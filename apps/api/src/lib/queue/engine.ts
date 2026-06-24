import { type Prisma, type QueueEventType } from '@odovox/db';
import { AppError, NotFoundError } from '../errors.js';
import { runWithContext } from '../request-context.js';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { VISIT_QUEUE_INCLUDE } from './snapshot.js';

/** The interactive-transaction client type of the extended Prisma client (with the scope/audit hooks). */
type QueueTx = ExtendedPrismaClient extends {
  $transaction(fn: (tx: infer T) => Promise<unknown>): Promise<unknown>;
}
  ? T
  : never;

export type QueueVisitRow = Prisma.VisitGetPayload<{ include: typeof VISIT_QUEUE_INCLUDE }>;

/** The minimal snapshot of a visit a transition needs (loaded by the route before mutating). */
export interface VisitLock {
  id: string;
  patientId: string;
  lifecycleVersion: number;
}

export interface LockedTransitionParams {
  clinicId: string;
  userId: string;
  visit: VisitLock;
  /** Fields to SET on the visit (status, timestamps, roomId, assignedDoctorId, priority, …). */
  data: Prisma.VisitUncheckedUpdateManyInput;
  eventType: QueueEventType;
  eventMetadata?: Prisma.InputJsonValue;
  auditAction: string;
  auditMetadata?: Prisma.InputJsonValue;
  /** Optional side-writes (bill/payment on complete, etc.) sharing the same atomic transaction. */
  extra?: (tx: QueueTx) => Promise<void>;
}

/** Optimistic-locked update inside a tx. Throws 409 STALE_VERSION if another writer won the race. */
async function lockedUpdate(tx: QueueTx, visit: VisitLock, data: Prisma.VisitUncheckedUpdateManyInput): Promise<void> {
  const res = await tx.visit.updateMany({
    where: { id: visit.id, lifecycleVersion: visit.lifecycleVersion },
    data: { ...data, lifecycleVersion: { increment: 1 } },
  });
  if (res.count === 0) {
    throw new AppError('This visit was just changed by someone else', 409, 'STALE_VERSION', {
      visitId: visit.id,
    });
  }
}

async function writeQueueEvent(
  tx: QueueTx,
  args: { clinicId: string; visitId: string; patientId: string; userId: string; type: QueueEventType; metadata?: Prisma.InputJsonValue },
): Promise<void> {
  await tx.queueEvent.create({
    data: {
      clinicId: args.clinicId,
      visitId: args.visitId,
      patientId: args.patientId,
      type: args.type,
      byUserId: args.userId,
      metadata: args.metadata ?? {},
    },
  });
}

/**
 * The shared write path for a single-visit transition. Runs inside a clinic-scoped context so the
 * Prisma scope middleware injects clinicId (defence-in-depth: a cross-clinic visit id can't match).
 * Order: optimistic-locked update → side writes → QueueEvent → explicit audit → reload. Atomic.
 */
export async function runLockedTransition(
  prisma: ExtendedPrismaClient,
  p: LockedTransitionParams,
): Promise<QueueVisitRow> {
  return runWithContext({ clinicId: p.clinicId, userId: p.userId }, () =>
    prisma.$transaction(async (tx) => {
      await lockedUpdate(tx, p.visit, p.data);
      if (p.extra) await p.extra(tx);
      await writeQueueEvent(tx, {
        clinicId: p.clinicId,
        visitId: p.visit.id,
        patientId: p.visit.patientId,
        userId: p.userId,
        type: p.eventType,
        metadata: p.eventMetadata,
      });
      await tx.auditLog.create({
        data: {
          clinicId: p.clinicId,
          userId: p.userId,
          action: p.auditAction,
          entityType: 'Visit',
          entityId: p.visit.id,
          metadata: p.auditMetadata ?? {},
        },
      });
      const reloaded = await tx.visit.findFirst({ where: { id: p.visit.id }, include: VISIT_QUEUE_INCLUDE });
      if (!reloaded) throw new NotFoundError('Visit not found');
      return reloaded;
    }),
  );
}

export interface CallInParams {
  clinicId: string;
  userId: string;
  visit: VisitLock & { assignedDoctorId: string | null; doctorId: string };
  roomId: string | null;
}

export interface CallInResult {
  visit: QueueVisitRow;
  /** The doctor's previous in-chair patient, auto-moved to CHECKOUT (if any). */
  autoCheckedOut: QueueVisitRow | null;
}

/**
 * Call a waiting patient into the chair. Compound + atomic: the doctor's existing IN_CHAIR visit (if
 * any) is auto-moved to CHECKOUT first, then the target visit is locked into IN_CHAIR with a room.
 * Both visits are reloaded so the route can broadcast each.
 */
export async function callInVisit(prisma: ExtendedPrismaClient, p: CallInParams): Promise<CallInResult> {
  const doctorId = p.visit.assignedDoctorId ?? p.visit.doctorId;
  return runWithContext({ clinicId: p.clinicId, userId: p.userId }, () =>
    prisma.$transaction(async (tx) => {
      let autoCheckedOut: QueueVisitRow | null = null;

      // 1. Auto-checkout the doctor's current in-chair patient (if any) — frees the chair.
      const prev = await tx.visit.findFirst({
        where: {
          status: 'IN_CHAIR',
          assignedDoctorId: doctorId,
          id: { not: p.visit.id },
          deletedAt: null,
        },
      });
      if (prev) {
        await lockedUpdate(tx, prev, {
          status: 'CHECKOUT',
          checkoutStartedAt: new Date(),
          endedAt: new Date(),
        });
        await writeQueueEvent(tx, {
          clinicId: p.clinicId,
          visitId: prev.id,
          patientId: prev.patientId,
          userId: p.userId,
          type: 'CHECKOUT_STARTED',
          metadata: { reason: 'auto-checkout on next call-in' },
        });
        const prevReloaded = await tx.visit.findFirst({ where: { id: prev.id }, include: VISIT_QUEUE_INCLUDE });
        autoCheckedOut = prevReloaded ?? null;
      }

      // 2. Pick a room: explicit > first AVAILABLE > none (warn handled by caller via null roomName).
      let roomId = p.roomId;
      if (!roomId) {
        const room = await tx.room.findFirst({ where: { status: 'AVAILABLE', deletedAt: null }, orderBy: { number: 'asc' } });
        roomId = room?.id ?? null;
      }
      if (roomId) {
        await tx.room.update({ where: { id: roomId }, data: { status: 'OCCUPIED' } });
      }

      // 3. Lock the target into the chair.
      await lockedUpdate(tx, p.visit, {
        status: 'IN_CHAIR',
        roomId,
        assignedDoctorId: doctorId,
        calledInAt: new Date(),
        startedAt: new Date(),
      });
      await writeQueueEvent(tx, {
        clinicId: p.clinicId,
        visitId: p.visit.id,
        patientId: p.visit.patientId,
        userId: p.userId,
        type: 'CALLED_IN',
        metadata: { roomId },
      });
      await tx.auditLog.create({
        data: {
          clinicId: p.clinicId,
          userId: p.userId,
          action: 'QUEUE_CALL_IN',
          entityType: 'Visit',
          entityId: p.visit.id,
          metadata: { roomId, autoCheckedOutVisitId: autoCheckedOut?.id ?? null },
        },
      });

      const reloaded = await tx.visit.findFirst({ where: { id: p.visit.id }, include: VISIT_QUEUE_INCLUDE });
      if (!reloaded) throw new NotFoundError('Visit not found');
      return { visit: reloaded, autoCheckedOut };
    }),
  );
}

export interface CreateWalkInParams {
  clinicId: string;
  userId: string;
  patientId: string;
  doctorId: string;
  chiefComplaint?: string | null;
  priority: number;
  appointmentId?: string | null;
}

/** Create a walk-in visit directly in WAITING (patient is already physically present). */
export async function createWalkIn(prisma: ExtendedPrismaClient, p: CreateWalkInParams): Promise<QueueVisitRow> {
  return runWithContext({ clinicId: p.clinicId, userId: p.userId }, () =>
    prisma.$transaction(async (tx) => {
      // Token number is per-clinic, monotonic for the day's queue. Use the running max + 1.
      const last = await tx.visit.findFirst({ orderBy: { tokenNumber: 'desc' }, select: { tokenNumber: true } });
      const tokenNumber = (last?.tokenNumber ?? 0) + 1;
      const visit = await tx.visit.create({
        data: {
          clinicId: p.clinicId,
          patientId: p.patientId,
          doctorId: p.doctorId,
          assignedDoctorId: p.doctorId,
          status: 'WAITING',
          tokenNumber,
          priority: p.priority,
          checkedInAt: new Date(),
          chiefComplaint: p.chiefComplaint ?? null,
          manualEntry: true,
        },
      });
      await writeQueueEvent(tx, {
        clinicId: p.clinicId,
        visitId: visit.id,
        patientId: p.patientId,
        userId: p.userId,
        type: 'CHECKED_IN',
        metadata: { walkIn: true, appointmentId: p.appointmentId ?? null },
      });
      await tx.auditLog.create({
        data: {
          clinicId: p.clinicId,
          userId: p.userId,
          action: 'QUEUE_WALK_IN',
          entityType: 'Visit',
          entityId: visit.id,
          metadata: { patientId: p.patientId, doctorId: p.doctorId },
        },
      });
      const reloaded = await tx.visit.findFirst({ where: { id: visit.id }, include: VISIT_QUEUE_INCLUDE });
      if (!reloaded) throw new NotFoundError('Visit not found');
      return reloaded;
    }),
  );
}
