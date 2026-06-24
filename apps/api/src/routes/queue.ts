import type { FastifyInstance, FastifyRequest } from 'fastify';
import {
  CallInInput,
  CancelVisitInput,
  CheckInInput,
  CheckoutInput,
  CompleteVisitInput,
  CreateWalkInInput,
  PriorityInput,
  QueueFilter,
  ReassignInput,
  ReturnToQueueInput,
  type ActivityItem,
  type ServerEvent,
  type VisitWithPatient,
} from '@odovox/types';
import type { VisitStatus } from '@odovox/db';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole } from '../lib/rbac.js';
import { getQueueSnapshot, serializeQueueVisit } from '../lib/queue/snapshot.js';
import {
  callInVisit,
  createWalkIn,
  runLockedTransition,
  type QueueVisitRow,
} from '../lib/queue/engine.js';
import { assertReorderable, assertTransition } from '../lib/queue/transitions.js';
import { buildActivityItem } from '../lib/queue/activity.js';
import { broadcastToClinic } from '../lib/realtime/broadcast.js';
import { getRecordingVisitIds } from '../lib/realtime/recording.js';

/** Fields every transition route needs off the current visit (loaded + clinic-scoped). */
const VISIT_LOCK_SELECT = {
  id: true,
  clinicId: true,
  patientId: true,
  doctorId: true,
  assignedDoctorId: true,
  roomId: true,
  status: true,
  lifecycleVersion: true,
} as const;

type VisitLockRow = {
  id: string;
  clinicId: string;
  patientId: string;
  doctorId: string;
  assignedDoctorId: string | null;
  roomId: string | null;
  status: VisitStatus;
  lifecycleVersion: number;
};

export async function queueRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const receptionistOnly = { preHandler: [fastify.authenticate, requireRole('RECEPTIONIST', 'ADMIN')] };
  const doctorOnly = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] };
  const doctorOrReceptionist = anyRole;

  /** Load a visit, clinic-scoped (404 across clinics) — selecting only what transitions need. */
  async function loadVisit(id: string): Promise<VisitLockRow> {
    const v = await prisma.visit.findFirst({ where: { id, deletedAt: null }, select: VISIT_LOCK_SELECT });
    if (!v) throw new NotFoundError('Visit not found');
    return v;
  }

  /** Doctors may only act on their own queue (assignedDoctorId === self). ADMIN bypasses. */
  async function assertDoctorOwns(req: FastifyRequest, visit: VisitLockRow): Promise<void> {
    if (req.role !== 'DOCTOR') return;
    const owner = visit.assignedDoctorId ?? visit.doctorId;
    if (owner !== req.user!.id) {
      await fastify.audit('ACCESS_DENIED', 'Visit', visit.id, {
        reason: 'doctor not assigned to this visit',
        owner,
      });
      throw new ForbiddenError('You can only act on patients in your own queue');
    }
  }

  /** Re-read the just-written QueueEvent (+ names) and push a live activity item to the clinic. */
  async function broadcastActivity(clinicId: string, visitId: string): Promise<void> {
    const ev = await prisma.queueEvent.findFirst({
      where: { visitId },
      orderBy: { createdAt: 'desc' },
      include: { byUser: { select: { name: true } }, patient: { select: { name: true } } },
    });
    if (!ev) return;
    const item: ActivityItem = buildActivityItem(ev, ev.patient.name, ev.byUser?.name ?? null);
    broadcastToClinic(clinicId, { type: 'activity', payload: item });
  }

  /** Serialize + broadcast a single visit event, then push the matching activity item. */
  async function emitVisit(
    clinicId: string,
    visit: QueueVisitRow,
    type: Extract<ServerEvent, { payload: VisitWithPatient }>['type'],
  ): Promise<void> {
    const recording = await getRecordingVisitIds(fastify.redis, clinicId);
    broadcastToClinic(clinicId, { type, payload: serializeQueueVisit(visit, recording.has(visit.id)) });
  }

  // ---- GET /queue -----------------------------------------------------------
  fastify.get('/queue', anyRole, async (req) => {
    const q = (req.query as { doctor?: string }).doctor;
    const filter = QueueFilter.safeParse(q).success
      ? QueueFilter.parse(q)
      : req.role === 'DOCTOR'
        ? 'me'
        : 'all';
    const recording = await getRecordingVisitIds(fastify.redis, req.clinicId!);
    const snapshot = await getQueueSnapshot(prisma, req.clinicId!, { recordingVisitIds: recording });
    if (filter === 'me') {
      snapshot.visits = snapshot.visits.filter(
        (v) => (v.assignedDoctorId ?? v.doctorId) === req.user!.id,
      );
    }
    return ok(snapshot);
  });

  // ---- POST /visits — receptionist creates a walk-in (lands in WAITING) -----
  fastify.post('/visits', receptionistOnly, async (req) => {
    const body = parse(CreateWalkInInput, req.body);
    const [patient, doctor] = await Promise.all([
      prisma.patient.findFirst({ where: { id: body.patientId, deletedAt: null } }),
      prisma.clinicMember.findFirst({
        where: { userId: body.doctorId, role: 'DOCTOR', status: 'ACTIVE', deletedAt: null },
      }),
    ]);
    if (!patient) throw new NotFoundError('Patient not found');
    if (!doctor) throw new ValidationError('Assigned doctor is not an active doctor in this clinic');
    if (body.appointmentId) {
      const appt = await prisma.appointment.findFirst({ where: { id: body.appointmentId } });
      if (!appt) throw new NotFoundError('Appointment not found');
    }

    const visit = await createWalkIn(prisma, {
      clinicId: req.clinicId!,
      userId: req.user!.id,
      patientId: body.patientId,
      doctorId: body.doctorId,
      chiefComplaint: body.chiefComplaint ?? null,
      priority: body.priority,
      appointmentId: body.appointmentId ?? null,
    });
    await emitVisit(req.clinicId!, visit, 'queue.visit.checked_in');
    await broadcastActivity(req.clinicId!, visit.id);
    return ok(serializeQueueVisit(visit));
  });

  // ---- POST /visits/:id/check-in — receptionist marks a scheduled patient arrived ----
  fastify.post('/visits/:id/check-in', receptionistOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(CheckInInput, req.body);
    const visit = await loadVisit(id);
    assertTransition('checkIn', visit.status);

    const assignedDoctorId = body.doctorId ?? visit.assignedDoctorId ?? visit.doctorId;
    const updated = await runLockedTransition(prisma, {
      clinicId: req.clinicId!,
      userId: req.user!.id,
      visit,
      data: {
        status: 'WAITING',
        checkedInAt: new Date(),
        assignedDoctorId,
        doctorId: assignedDoctorId,
        ...(body.priority != null ? { priority: body.priority } : {}),
      },
      eventType: 'CHECKED_IN',
      eventMetadata: { assignedDoctorId },
      auditAction: 'QUEUE_CHECK_IN',
    });
    await emitVisit(req.clinicId!, updated, 'queue.visit.checked_in');
    await broadcastActivity(req.clinicId!, updated.id);
    return ok(serializeQueueVisit(updated));
  });

  // ---- POST /visits/:id/call-in — doctor moves a waiting patient to the chair ----
  fastify.post('/visits/:id/call-in', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(CallInInput, req.body);
    const visit = await loadVisit(id);
    assertTransition('callIn', visit.status);
    // Doctors call into their OWN queue only (null = unassigned walk-in, claimable).
    if (req.role === 'DOCTOR' && visit.assignedDoctorId && visit.assignedDoctorId !== req.user!.id) {
      await fastify.audit('ACCESS_DENIED', 'Visit', visit.id, { reason: 'call-in another doctor queue' });
      throw new ForbiddenError('You can only call in patients from your own queue');
    }
    if (body.roomId) {
      const room = await prisma.room.findFirst({ where: { id: body.roomId, deletedAt: null } });
      if (!room) throw new NotFoundError('Room not found');
    }

    const { visit: updated, autoCheckedOut } = await callInVisit(prisma, {
      clinicId: req.clinicId!,
      userId: req.user!.id,
      visit: { ...visit, assignedDoctorId: req.role === 'DOCTOR' ? req.user!.id : visit.assignedDoctorId },
      roomId: body.roomId ?? null,
    });
    if (autoCheckedOut) {
      await emitVisit(req.clinicId!, autoCheckedOut, 'queue.visit.checkout');
      await broadcastActivity(req.clinicId!, autoCheckedOut.id);
    }
    await emitVisit(req.clinicId!, updated, 'queue.visit.called_in');
    await broadcastActivity(req.clinicId!, updated.id);
    return ok({ visit: serializeQueueVisit(updated), autoCheckedOut: autoCheckedOut ? serializeQueueVisit(autoCheckedOut) : null });
  });

  // ---- POST /visits/:id/return-to-queue — doctor sends in-chair patient back ----
  fastify.post('/visits/:id/return-to-queue', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(ReturnToQueueInput, req.body);
    const visit = await loadVisit(id);
    assertTransition('returnToQueue', visit.status);
    await assertDoctorOwns(req, visit);

    const updated = await runLockedTransition(prisma, {
      clinicId: req.clinicId!,
      userId: req.user!.id,
      visit,
      data: { status: 'WAITING', calledInAt: null, roomId: null, startedAt: null },
      eventType: 'RETURNED_TO_QUEUE',
      eventMetadata: { reason: body.reason ?? null },
      auditAction: 'QUEUE_RETURN',
      auditMetadata: { reason: body.reason ?? null },
      extra: async (tx) => {
        // Free the room the patient was occupying.
        if (visit.roomId) await tx.room.update({ where: { id: visit.roomId }, data: { status: 'AVAILABLE' } });
      },
    });
    await emitVisit(req.clinicId!, updated, 'queue.visit.returned');
    await broadcastActivity(req.clinicId!, updated.id);
    return ok(serializeQueueVisit(updated));
  });

  // ---- POST /visits/:id/checkout — manual IN_CHAIR → CHECKOUT ----------------
  fastify.post('/visits/:id/checkout', doctorOrReceptionist, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(CheckoutInput, req.body);
    const visit = await loadVisit(id);
    assertTransition('checkout', visit.status);
    await assertDoctorOwns(req, visit);

    const updated = await runLockedTransition(prisma, {
      clinicId: req.clinicId!,
      userId: req.user!.id,
      visit,
      data: { status: 'CHECKOUT', checkoutStartedAt: new Date(), endedAt: new Date() },
      eventType: 'CHECKOUT_STARTED',
      eventMetadata: { reason: body.reason ?? null, manual: true },
      auditAction: 'QUEUE_CHECKOUT',
      extra: async (tx) => {
        if (visit.roomId) await tx.room.update({ where: { id: visit.roomId }, data: { status: 'AVAILABLE' } });
      },
    });
    await emitVisit(req.clinicId!, updated, 'queue.visit.checkout');
    await broadcastActivity(req.clinicId!, updated.id);
    return ok(serializeQueueVisit(updated));
  });

  // ---- POST /visits/:id/complete — receptionist finishes checkout -----------
  fastify.post('/visits/:id/complete', receptionistOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(CompleteVisitInput, req.body);
    const visit = await loadVisit(id);
    assertTransition('complete', visit.status);

    const updated = await runLockedTransition(prisma, {
      clinicId: req.clinicId!,
      userId: req.user!.id,
      visit,
      data: { status: 'COMPLETED', completedAt: new Date() },
      eventType: 'COMPLETED',
      eventMetadata: {
        prescriptionHanded: body.prescriptionHanded,
        nextVisitConfirmed: body.nextVisitConfirmed,
        paymentMethod: body.payment?.method ?? null,
      },
      auditAction: 'QUEUE_COMPLETE',
      auditMetadata: { paidPaise: body.payment?.amountPaise ?? 0, method: body.payment?.method ?? null },
      // Minimal billing now; Phase 8 reworks with Razorpay. Record a Bill + Payment if money moved.
      extra: async (tx) => {
        if (!body.payment) return;
        const existing = await tx.bill.findFirst({ where: { visitId: visit.id, deletedAt: null } });
        const bill =
          existing ??
          (await tx.bill.create({
            data: {
              visitId: visit.id,
              patientId: visit.patientId,
              items: [],
              totalPaise: body.payment.amountPaise,
              paidPaise: 0,
            },
          }));
        await tx.payment.create({
          data: {
            billId: bill.id,
            amountPaise: body.payment.amountPaise,
            method: body.payment.method,
            reference: body.payment.reference ?? null,
            receivedById: req.user!.id,
          },
        });
        const paidPaise = bill.paidPaise + body.payment.amountPaise;
        const status = paidPaise >= bill.totalPaise ? 'PAID' : paidPaise > 0 ? 'PARTIAL' : 'PENDING';
        await tx.bill.update({ where: { id: bill.id }, data: { paidPaise, status } });
      },
    });
    await broadcastToClinic(req.clinicId!, { type: 'queue.visit.completed', payload: { visitId: updated.id } });
    await broadcastActivity(req.clinicId!, updated.id);
    return ok(serializeQueueVisit(updated));
  });

  // ---- POST /visits/:id/cancel — either role; reason required ---------------
  fastify.post('/visits/:id/cancel', doctorOrReceptionist, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(CancelVisitInput, req.body);
    const visit = await loadVisit(id);
    assertTransition('cancel', visit.status);
    await assertDoctorOwns(req, visit);

    const updated = await runLockedTransition(prisma, {
      clinicId: req.clinicId!,
      userId: req.user!.id,
      visit,
      data: { status: 'CANCELLED', endedAt: new Date() },
      eventType: 'CANCELLED',
      eventMetadata: { reason: body.reason },
      auditAction: 'QUEUE_CANCEL',
      auditMetadata: { reason: body.reason },
      extra: async (tx) => {
        if (visit.roomId) await tx.room.update({ where: { id: visit.roomId }, data: { status: 'AVAILABLE' } });
      },
    });
    broadcastToClinic(req.clinicId!, { type: 'queue.visit.cancelled', payload: { visitId: updated.id, reason: body.reason } });
    await broadcastActivity(req.clinicId!, updated.id);
    return ok(serializeQueueVisit(updated));
  });

  // ---- POST /visits/:id/reassign — receptionist moves visit to another doctor ----
  fastify.post('/visits/:id/reassign', receptionistOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(ReassignInput, req.body);
    const visit = await loadVisit(id);
    assertReorderable(visit.status);
    const doctor = await prisma.clinicMember.findFirst({
      where: { userId: body.doctorId, role: 'DOCTOR', status: 'ACTIVE', deletedAt: null },
    });
    if (!doctor) throw new ValidationError('Target is not an active doctor in this clinic');

    const updated = await runLockedTransition(prisma, {
      clinicId: req.clinicId!,
      userId: req.user!.id,
      visit,
      data: { assignedDoctorId: body.doctorId, doctorId: body.doctorId },
      eventType: 'REASSIGNED',
      eventMetadata: { fromDoctorId: visit.assignedDoctorId, toDoctorId: body.doctorId },
      auditAction: 'QUEUE_REASSIGN',
      auditMetadata: { fromDoctorId: visit.assignedDoctorId, toDoctorId: body.doctorId },
    });
    await emitVisit(req.clinicId!, updated, 'queue.visit.reassigned');
    await broadcastActivity(req.clinicId!, updated.id);
    return ok(serializeQueueVisit(updated));
  });

  // ---- POST /visits/:id/priority — receptionist bumps/lowers priority -------
  fastify.post('/visits/:id/priority', receptionistOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(PriorityInput, req.body);
    const visit = await loadVisit(id);
    assertReorderable(visit.status);

    const updated = await runLockedTransition(prisma, {
      clinicId: req.clinicId!,
      userId: req.user!.id,
      visit,
      data: { priority: body.priority },
      eventType: 'PRIORITY_CHANGED',
      eventMetadata: { priority: body.priority },
      auditAction: 'QUEUE_PRIORITY',
      auditMetadata: { priority: body.priority },
    });
    await emitVisit(req.clinicId!, updated, 'queue.visit.priority_changed');
    await broadcastActivity(req.clinicId!, updated.id);
    return ok(serializeQueueVisit(updated));
  });

  // ---- GET /activity — last 50 queue events (receptionist dashboard) --------
  fastify.get('/activity', receptionistOnly, async (req) => {
    const rows = await prisma.queueEvent.findMany({
      where: { clinicId: req.clinicId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { byUser: { select: { name: true } }, patient: { select: { name: true } } },
    });
    const items: ActivityItem[] = rows.map((ev) => buildActivityItem(ev, ev.patient.name, ev.byUser?.name ?? null));
    return ok({ items });
  });
}
