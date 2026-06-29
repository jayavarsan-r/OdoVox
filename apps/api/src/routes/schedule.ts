import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  CancelAppointmentInput,
  CreateAppointmentInput,
  CreateDayOffInput,
  CreateDoctorAvailabilityInput,
  RecurringAppointmentInput,
  RescheduleAppointmentInput,
  SeriesCancelInput,
  UpdateAppointmentInput,
  UpdateDoctorAvailabilityInput,
  type Conflict,
  type ScheduleAppointment,
} from '@odovox/types';
import { AppError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole } from '../lib/rbac.js';
import { broadcastToClinic } from '../lib/realtime/broadcast.js';
import {
  detectConflicts,
  generateRecurringSeries,
  getAvailableSlots,
  localDateTimeToUtc,
  type AvailabilityWindow,
  type DayOffInput,
  type ExistingAppointment,
  type ScheduleClinicHours,
} from '../lib/schedule/index.js';
import { APPOINTMENT_INCLUDE, serializeAppointment } from '../lib/schedule/serialize.js';
import { reminderDrafts } from '../lib/schedule/reminders.js';

const DateQuery = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  doctorId: z.string().min(1),
  durationMinutes: z.coerce.number().int().min(5).max(600).default(30),
});

const ScheduleQuery = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  doctorId: z.string().min(1).default('me'),
  view: z.enum(['day', 'week']).default('day'),
});

const DAY_MS = 24 * 60 * 60 * 1000;

export async function scheduleRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const staffOnly = { preHandler: [fastify.authenticate, requireRole('RECEPTIONIST', 'ADMIN')] };

  // ── Loaders ───────────────────────────────────────────────────────────────────────────────
  async function clinicHoursOf(clinicId: string): Promise<ScheduleClinicHours> {
    const c = await prisma.clinic.findUniqueOrThrow({
      where: { id: clinicId },
      select: {
        openingTime: true,
        closingTime: true,
        lunchStart: true,
        lunchEnd: true,
        weeklyOffDays: true,
        timezone: true,
      },
    });
    return {
      open: c.openingTime,
      close: c.closingTime,
      lunchStart: c.lunchStart,
      lunchEnd: c.lunchEnd,
      weeklyOffDays: c.weeklyOffDays,
      timezone: c.timezone,
    };
  }

  async function availabilityOf(clinicId: string, doctorId: string): Promise<AvailabilityWindow[]> {
    const rows = await prisma.doctorAvailability.findMany({ where: { clinicId, doctorId } });
    return rows.map((r) => ({
      doctorId: r.doctorId,
      dayOfWeek: r.dayOfWeek,
      startTime: r.startTime,
      endTime: r.endTime,
      effectiveFrom: r.effectiveFrom,
      effectiveTo: r.effectiveTo,
    }));
  }

  async function dayOffsOf(clinicId: string, doctorId?: string): Promise<DayOffInput[]> {
    const rows = await prisma.dayOff.findMany({
      where: {
        clinicId,
        OR: [{ scope: 'CLINIC' }, { scope: 'DOCTOR', ...(doctorId ? { doctorId } : {}) }],
      },
    });
    return rows.map((r) => ({
      date: r.date,
      endDate: r.endDate,
      scope: r.scope as 'CLINIC' | 'DOCTOR',
      doctorId: r.doctorId,
    }));
  }

  /** Occupying appointments in a UTC window — for slot/conflict computation. */
  async function occupyingAround(
    clinicId: string,
    startsAt: Date,
    endsAt: Date,
    doctorId?: string,
  ): Promise<ExistingAppointment[]> {
    const rows = await prisma.appointment.findMany({
      where: {
        clinicId,
        deletedAt: null,
        status: { in: ['SCHEDULED', 'CHECKED_IN'] },
        startsAt: { gte: new Date(startsAt.getTime() - DAY_MS), lte: new Date(endsAt.getTime() + DAY_MS) },
        ...(doctorId ? { doctorId } : {}),
      },
      select: { id: true, doctorId: true, roomId: true, patientId: true, startsAt: true, endsAt: true, status: true },
    });
    return rows;
  }

  // ── Conflict gate ───────────────────────────────────────────────────────────────────────────
  async function runConflicts(
    clinicId: string,
    appt: { doctorId: string; roomId?: string | null; patientId?: string; startsAt: Date; endsAt: Date; excludeAppointmentId?: string },
  ): Promise<Conflict[]> {
    const [clinicHours, availability, dayOffs, existing] = await Promise.all([
      clinicHoursOf(clinicId),
      availabilityOf(clinicId, appt.doctorId),
      dayOffsOf(clinicId, appt.doctorId),
      occupyingAround(clinicId, appt.startsAt, appt.endsAt),
    ]);
    return detectConflicts({
      appointment: { clinicId, ...appt },
      existingAppointments: existing,
      doctorAvailability: availability,
      clinicHours,
      dayOffs,
      bufferMinutes: 5,
    });
  }

  /** Throw 409 CONFLICTS when any HARD conflict, or any SOFT conflict not acknowledged, is present. */
  function gateConflicts(conflicts: Conflict[], acknowledged: string[] = []): void {
    const hard = conflicts.filter((c) => c.kind === 'HARD');
    const unackedSoft = conflicts.filter((c) => c.kind === 'SOFT' && !acknowledged.includes(c.code));
    if (hard.length > 0 || unackedSoft.length > 0) {
      throw new AppError('Scheduling conflicts', 409, 'CONFLICTS', {
        conflicts: [...hard, ...unackedSoft],
      });
    }
  }

  /** First room with no occupying overlap in [startsAt,endsAt], or null. */
  async function pickRoom(clinicId: string, startsAt: Date, endsAt: Date, excludeId?: string): Promise<string | null> {
    const rooms = await prisma.room.findMany({ where: { clinicId, deletedAt: null, status: { not: 'OFFLINE' } }, select: { id: true } });
    if (rooms.length === 0) return null;
    const busy = await occupyingAround(clinicId, startsAt, endsAt);
    for (const r of rooms) {
      const clash = busy.some(
        (b) => b.roomId === r.id && b.id !== excludeId && b.startsAt.getTime() < endsAt.getTime() && b.endsAt.getTime() > startsAt.getTime(),
      );
      if (!clash) return r.id;
    }
    return null;
  }

  /**
   * Admin capability is the membership `isAdmin` flag, not a distinct token role: the clinic creator
   * is role DOCTOR + isAdmin. So "ADMIN" in the Phase 6 RBAC matrix means role ADMIN *or* isAdmin.
   */
  async function callerIsAdmin(req: FastifyRequest): Promise<boolean> {
    if (req.role === 'ADMIN') return true;
    const m = await prisma.clinicMember.findFirst({
      where: { clinicId: req.clinicId!, userId: req.user!.id },
      select: { isAdmin: true },
    });
    return !!m?.isAdmin;
  }

  async function loadApptOr404(clinicId: string, id: string) {
    const a = await prisma.appointment.findFirst({ where: { id, clinicId, deletedAt: null } });
    if (!a) throw new NotFoundError('Appointment not found');
    return a;
  }

  /** Doctors may only create/act on appointments in their own queue. ADMIN/RECEPTIONIST bypass. */
  function assertDoctorOwns(req: FastifyRequest, doctorId: string): void {
    if (req.role === 'DOCTOR' && doctorId !== req.user!.id) {
      throw new ForbiddenError('Doctors can only manage their own appointments');
    }
  }

  /** Re-load with joins and broadcast a schedule event after commit. */
  async function broadcastAppt(clinicId: string, id: string, type: ScheduleEvent): Promise<ScheduleAppointment> {
    const full = await prisma.appointment.findFirstOrThrow({ where: { id, clinicId }, include: APPOINTMENT_INCLUDE });
    const payload = serializeAppointment(full);
    broadcastToClinic(clinicId, { type, payload } as never);
    return payload;
  }

  type ScheduleEvent =
    | 'schedule.appointment.created'
    | 'schedule.appointment.rescheduled'
    | 'schedule.appointment.cancelled'
    | 'schedule.appointment.no_show';

  // ── GET /schedule ─────────────────────────────────────────────────────────────────────────
  fastify.get('/schedule', anyRole, async (req) => {
    const q = parse(ScheduleQuery, req.query);
    const clinicId = req.clinicId!;
    const hours = await clinicHoursOf(clinicId);
    const tz = hours.timezone;

    let doctorFilter: string | undefined;
    if (q.doctorId === 'me') {
      doctorFilter = req.user!.id;
    } else if (q.doctorId === 'all') {
      if (req.role === 'DOCTOR') throw new ForbiddenError('Doctors can only view their own schedule');
      doctorFilter = undefined; // all doctors
    } else {
      if (req.role === 'DOCTOR' && q.doctorId !== req.user!.id) {
        throw new ForbiddenError('Doctors can only view their own schedule');
      }
      doctorFilter = q.doctorId;
    }

    const start = localDateTimeToUtc(q.from, '00:00', tz);
    const end = new Date(localDateTimeToUtc(q.to, '00:00', tz).getTime() + DAY_MS); // exclusive end of `to`

    const appts = await prisma.appointment.findMany({
      where: {
        clinicId,
        deletedAt: null,
        startsAt: { gte: start, lt: end },
        ...(doctorFilter ? { doctorId: doctorFilter } : {}),
      },
      include: APPOINTMENT_INCLUDE,
      orderBy: { startsAt: 'asc' },
    });

    const [availabilityRows, dayOffRows] = await Promise.all([
      prisma.doctorAvailability.findMany({ where: { clinicId, ...(doctorFilter ? { doctorId: doctorFilter } : {}) } }),
      prisma.dayOff.findMany({ where: { clinicId, date: { lt: end } } }),
    ]);

    return ok({
      appointments: appts.map(serializeAppointment),
      availability: availabilityRows.map((r) => ({
        id: r.id,
        doctorId: r.doctorId,
        dayOfWeek: r.dayOfWeek,
        startTime: r.startTime,
        endTime: r.endTime,
      })),
      dayOffs: dayOffRows.map((r) => ({
        id: r.id,
        date: r.date,
        endDate: r.endDate,
        scope: r.scope,
        doctorId: r.doctorId,
        reason: r.reason,
      })),
      clinicHours: { open: hours.open, close: hours.close, lunchStart: hours.lunchStart, lunchEnd: hours.lunchEnd, weeklyOffDays: hours.weeklyOffDays, timezone: tz },
    });
  });

  // ── GET /patients/:patientId/appointments (upcoming, for the patient overview card) ──────────
  fastify.get('/patients/:patientId/appointments', anyRole, async (req) => {
    const { patientId } = req.params as { patientId: string };
    const clinicId = req.clinicId!;
    const rows = await prisma.appointment.findMany({
      where: { clinicId, patientId, deletedAt: null, status: 'SCHEDULED', startsAt: { gte: new Date() } },
      include: APPOINTMENT_INCLUDE,
      orderBy: { startsAt: 'asc' },
      take: 20,
    });
    return ok({ appointments: rows.map(serializeAppointment) });
  });

  // ── GET /schedule/slots ───────────────────────────────────────────────────────────────────
  fastify.get('/schedule/slots', anyRole, async (req) => {
    const q = parse(DateQuery, req.query);
    const clinicId = req.clinicId!;
    const [clinicHours, availability, dayOffs] = await Promise.all([
      clinicHoursOf(clinicId),
      availabilityOf(clinicId, q.doctorId),
      dayOffsOf(clinicId, q.doctorId),
    ]);
    const dayStart = localDateTimeToUtc(q.date, '00:00', clinicHours.timezone);
    const existing = await occupyingAround(clinicId, dayStart, new Date(dayStart.getTime() + DAY_MS), q.doctorId);
    const slots = getAvailableSlots({
      dateISO: q.date,
      doctorId: q.doctorId,
      doctorAvailability: availability,
      clinicHours,
      dayOffs,
      existingAppointments: existing,
      durationMinutes: q.durationMinutes,
    });
    return ok({ slots });
  });

  // ── POST /appointments ──────────────────────────────────────────────────────────────────────
  fastify.post('/appointments', anyRole, async (req, reply) => {
    const body = parse(CreateAppointmentInput, req.body);
    const clinicId = req.clinicId!;
    assertDoctorOwns(req, body.doctorId);

    const startsAt = body.startsAt;
    const endsAt = new Date(startsAt.getTime() + body.durationMinutes * 60_000);
    const roomId = body.roomId ?? (await pickRoom(clinicId, startsAt, endsAt));

    const conflicts = await runConflicts(clinicId, {
      doctorId: body.doctorId,
      roomId,
      patientId: body.patientId,
      startsAt,
      endsAt,
    });
    gateConflicts(conflicts, body.acknowledgedSoftConflicts);

    const created = await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          clinicId,
          patientId: body.patientId,
          doctorId: body.doctorId,
          createdById: req.user!.id,
          roomId,
          startsAt,
          endsAt,
          durationMinutes: body.durationMinutes,
          procedureHint: body.procedureHint ?? null,
          notes: body.notes ?? null,
          treatmentPlanId: body.treatmentPlanId ?? null,
          sittingNumber: body.sittingNumber ?? null,
          status: 'SCHEDULED',
        },
      });
      await tx.appointmentReminder.createMany({
        data: reminderDrafts({ clinicId, appointmentId: appt.id, patientId: body.patientId, startsAt }),
      });
      return appt;
    });

    await fastify.audit('APPOINTMENT_CREATED', 'Appointment', created.id, {
      doctorId: body.doctorId,
      startsAt: startsAt.toISOString(),
      acceptedWarnings: conflicts.filter((c) => c.kind === 'SOFT').map((c) => c.code),
    });
    const payload = await broadcastAppt(clinicId, created.id, 'schedule.appointment.created');

    reply.status(201);
    return ok({ appointment: payload, conflicts });
  });

  // ── PATCH /appointments/:id (non-time edit) ───────────────────────────────────────────────────
  fastify.patch('/appointments/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(UpdateAppointmentInput, req.body);
    const clinicId = req.clinicId!;
    const existing = await loadApptOr404(clinicId, id);
    assertDoctorOwns(req, existing.doctorId);

    await prisma.appointment.update({
      where: { id },
      data: {
        ...(body.roomId !== undefined ? { roomId: body.roomId } : {}),
        ...(body.procedureHint !== undefined ? { procedureHint: body.procedureHint } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
    });
    await fastify.audit('APPOINTMENT_UPDATED', 'Appointment', id, {});
    const payload = await broadcastAppt(clinicId, id, 'schedule.appointment.created');
    return ok({ appointment: payload });
  });

  // ── POST /appointments/:id/reschedule ─────────────────────────────────────────────────────────
  fastify.post('/appointments/:id/reschedule', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(RescheduleAppointmentInput, req.body);
    const clinicId = req.clinicId!;
    const existing = await loadApptOr404(clinicId, id);
    assertDoctorOwns(req, existing.doctorId);

    const durationMinutes = body.newDurationMinutes ?? existing.durationMinutes;
    const startsAt = body.newStartsAt;
    const endsAt = new Date(startsAt.getTime() + durationMinutes * 60_000);

    const conflicts = await runConflicts(clinicId, {
      doctorId: existing.doctorId,
      roomId: existing.roomId,
      patientId: existing.patientId,
      startsAt,
      endsAt,
      excludeAppointmentId: id,
    });
    gateConflicts(conflicts, body.acknowledgedSoftConflicts);

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: {
          startsAt,
          endsAt,
          durationMinutes,
          originalStartsAt: existing.originalStartsAt ?? existing.startsAt,
          rescheduleCount: { increment: 1 },
        },
      });
      // Rebook reminders: cancel pending, create fresh for the new time.
      await tx.appointmentReminder.updateMany({
        where: { appointmentId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      await tx.appointmentReminder.createMany({
        data: reminderDrafts({ clinicId, appointmentId: id, patientId: existing.patientId, startsAt }),
      });
    });

    await fastify.audit('APPOINTMENT_RESCHEDULED', 'Appointment', id, {
      fromStartsAt: existing.startsAt.toISOString(),
      toStartsAt: startsAt.toISOString(),
    });
    const payload = await broadcastAppt(clinicId, id, 'schedule.appointment.rescheduled');
    return ok({ appointment: payload, conflicts });
  });

  // ── POST /appointments/:id/cancel ─────────────────────────────────────────────────────────────
  fastify.post('/appointments/:id/cancel', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(CancelAppointmentInput, req.body);
    const clinicId = req.clinicId!;
    const existing = await loadApptOr404(clinicId, id);
    assertDoctorOwns(req, existing.doctorId);

    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({
        where: { id },
        data: {
          status: 'CANCELLED',
          cancelledAt: new Date(),
          cancelledById: req.user!.id,
          cancellationReason: body.reason ?? null,
        },
      });
      await tx.appointmentReminder.updateMany({
        where: { appointmentId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    });
    await fastify.audit('APPOINTMENT_CANCELLED', 'Appointment', id, { reason: body.reason ?? null });
    const payload = await broadcastAppt(clinicId, id, 'schedule.appointment.cancelled');
    return ok({ appointment: payload });
  });

  // ── POST /appointments/:id/no-show (manual) ───────────────────────────────────────────────────
  fastify.post('/appointments/:id/no-show', staffOnly, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const existing = await loadApptOr404(clinicId, id);
    if (existing.status !== 'SCHEDULED') {
      throw new AppError('Only scheduled appointments can be marked no-show', 422, 'INVALID_STATUS', { status: existing.status });
    }
    await prisma.$transaction(async (tx) => {
      await tx.appointment.update({ where: { id }, data: { status: 'NO_SHOW', noShowAt: new Date() } });
      await tx.appointmentReminder.updateMany({ where: { appointmentId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    });
    await fastify.audit('APPOINTMENT_NO_SHOW', 'Appointment', id, {});
    const payload = await broadcastAppt(clinicId, id, 'schedule.appointment.no_show');
    return ok({ appointment: payload });
  });

  // ── POST /appointments/recurring ──────────────────────────────────────────────────────────────
  fastify.post('/appointments/recurring', anyRole, async (req, reply) => {
    const body = parse(RecurringAppointmentInput, req.body);
    const clinicId = req.clinicId!;
    assertDoctorOwns(req, body.doctorId);

    const [clinicHours, availability, dayOffs, existing] = await Promise.all([
      clinicHoursOf(clinicId),
      availabilityOf(clinicId, body.doctorId),
      dayOffsOf(clinicId, body.doctorId),
      occupyingAround(clinicId, body.firstStartsAt, new Date(body.firstStartsAt.getTime() + 370 * DAY_MS), body.doctorId),
    ]);

    const { plan, unscheduled } = generateRecurringSeries({
      firstStartsAt: body.firstStartsAt,
      durationMinutes: body.durationMinutes,
      totalOccurrences: body.totalOccurrences,
      interval: body.interval,
      doctorId: body.doctorId,
      doctorAvailability: availability,
      clinicHours,
      dayOffs,
      existingAppointments: existing,
    });

    if (unscheduled.length > 0) {
      throw new AppError('Some occurrences could not be scheduled', 409, 'SERIES_UNSCHEDULED', {
        plan: plan.map((p) => ({ seriesIndex: p.seriesIndex, startsAt: p.startsAt.toISOString() })),
        unscheduled,
      });
    }

    const seriesId = `series_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    const total = plan.length;
    const ids = await prisma.$transaction(async (tx) => {
      const out: string[] = [];
      for (const draft of plan) {
        const roomId = body.roomId ?? null;
        const appt = await tx.appointment.create({
          data: {
            clinicId,
            patientId: body.patientId,
            doctorId: body.doctorId,
            createdById: req.user!.id,
            roomId,
            startsAt: draft.startsAt,
            endsAt: draft.endsAt,
            durationMinutes: body.durationMinutes,
            procedureHint: body.procedureHint ?? null,
            treatmentPlanId: body.treatmentPlanId ?? null,
            sittingNumber: draft.seriesIndex,
            seriesId,
            seriesIndex: draft.seriesIndex,
            seriesTotal: total,
            status: 'SCHEDULED',
          },
        });
        await tx.appointmentReminder.createMany({
          data: reminderDrafts({ clinicId, appointmentId: appt.id, patientId: body.patientId, startsAt: draft.startsAt }),
        });
        out.push(appt.id);
      }
      return out;
    });

    await fastify.audit('APPOINTMENT_SERIES_CREATED', 'Appointment', seriesId, {
      seriesId,
      total,
      interval: body.interval,
      doctorId: body.doctorId,
    });
    // One bulk broadcast per appointment (documented choice: simplest for the calendar to place each).
    const payloads: ScheduleAppointment[] = [];
    for (const id of ids) payloads.push(await broadcastAppt(clinicId, id, 'schedule.appointment.created'));

    reply.status(201);
    return ok({ seriesId, appointments: payloads });
  });

  // ── POST /appointments/series/:seriesId/cancel ────────────────────────────────────────────────
  fastify.post('/appointments/series/:seriesId/cancel', anyRole, async (req) => {
    const { seriesId } = req.params as { seriesId: string };
    const body = parse(SeriesCancelInput, req.body);
    const clinicId = req.clinicId!;

    const members = await prisma.appointment.findMany({
      where: { clinicId, seriesId, deletedAt: null, status: { in: ['SCHEDULED', 'CHECKED_IN'] } },
      orderBy: { seriesIndex: 'asc' },
    });
    if (members.length === 0) throw new NotFoundError('Series not found');
    if (req.role === 'DOCTOR' && members.some((m) => m.doctorId !== req.user!.id)) {
      throw new ForbiddenError('Doctors can only manage their own appointments');
    }

    let toCancel = members;
    if (body.scope === 'THIS_ONLY') {
      toCancel = members.filter((m) => m.seriesIndex === body.startingFromIndex);
    } else if (body.scope === 'THIS_AND_FUTURE') {
      toCancel = members.filter((m) => (m.seriesIndex ?? 0) >= (body.startingFromIndex ?? 0));
    }

    const ids = toCancel.map((m) => m.id);
    await prisma.$transaction(async (tx) => {
      await tx.appointment.updateMany({
        where: { id: { in: ids } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: req.user!.id, cancellationReason: body.reason ?? 'Series cancelled' },
      });
      await tx.appointmentReminder.updateMany({ where: { appointmentId: { in: ids }, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    });
    await fastify.audit('APPOINTMENT_SERIES_CANCELLED', 'Appointment', seriesId, { scope: body.scope, count: ids.length });
    for (const id of ids) await broadcastAppt(clinicId, id, 'schedule.appointment.cancelled');
    return ok({ cancelled: ids.length });
  });

  // ── Availability CRUD ─────────────────────────────────────────────────────────────────────────
  fastify.get('/availability/doctor/:doctorId', anyRole, async (req) => {
    const { doctorId } = req.params as { doctorId: string };
    const rows = await prisma.doctorAvailability.findMany({
      where: { clinicId: req.clinicId!, doctorId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return ok({ availability: rows });
  });

  /** ADMIN may set any doctor's availability; a DOCTOR only their own; RECEPTIONIST never. */
  async function assertCanEditAvailability(req: FastifyRequest, doctorId: string): Promise<void> {
    if (await callerIsAdmin(req)) return;
    if (req.role === 'DOCTOR' && doctorId === req.user!.id) return;
    throw new ForbiddenError('Only an admin (any doctor) or the doctor themselves can set availability');
  }

  fastify.post('/availability/doctor/:doctorId', { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] }, async (req, reply) => {
    const { doctorId } = req.params as { doctorId: string };
    await assertCanEditAvailability(req, doctorId);
    const body = parse(CreateDoctorAvailabilityInput, req.body);
    const clinicId = req.clinicId!;

    const row = await prisma.doctorAvailability.create({
      data: {
        clinicId,
        doctorId,
        dayOfWeek: body.dayOfWeek,
        startTime: body.startTime,
        endTime: body.endTime,
        effectiveFrom: body.effectiveFrom ?? null,
        effectiveTo: body.effectiveTo ?? null,
      },
    });
    await fastify.audit('DOCTOR_AVAILABILITY_CREATED', 'DoctorAvailability', row.id, { doctorId, dayOfWeek: body.dayOfWeek });
    reply.status(201);
    return ok({ availability: row });
  });

  fastify.patch('/availability/:availabilityId', { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] }, async (req) => {
    const { availabilityId } = req.params as { availabilityId: string };
    const body = parse(UpdateDoctorAvailabilityInput, req.body);
    const clinicId = req.clinicId!;
    const existing = await prisma.doctorAvailability.findFirst({ where: { id: availabilityId, clinicId } });
    if (!existing) throw new NotFoundError('Availability not found');
    await assertCanEditAvailability(req, existing.doctorId);

    const row = await prisma.doctorAvailability.update({
      where: { id: availabilityId },
      data: {
        ...(body.startTime !== undefined ? { startTime: body.startTime } : {}),
        ...(body.endTime !== undefined ? { endTime: body.endTime } : {}),
        ...(body.effectiveFrom !== undefined ? { effectiveFrom: body.effectiveFrom } : {}),
        ...(body.effectiveTo !== undefined ? { effectiveTo: body.effectiveTo } : {}),
      },
    });

    // Surface (don't block) appointments that now fall outside the doctor's window — admin decides.
    const future = await prisma.appointment.findMany({
      where: { clinicId, doctorId: existing.doctorId, status: 'SCHEDULED', startsAt: { gte: new Date() } },
      select: { id: true, startsAt: true, endsAt: true },
    });
    await fastify.audit('DOCTOR_AVAILABILITY_UPDATED', 'DoctorAvailability', availabilityId, {});
    return ok({ availability: row, affectedAppointmentCount: future.length });
  });

  fastify.delete('/availability/:availabilityId', { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] }, async (req) => {
    const { availabilityId } = req.params as { availabilityId: string };
    const clinicId = req.clinicId!;
    const existing = await prisma.doctorAvailability.findFirst({ where: { id: availabilityId, clinicId } });
    if (!existing) throw new NotFoundError('Availability not found');
    await assertCanEditAvailability(req, existing.doctorId);
    await prisma.doctorAvailability.delete({ where: { id: availabilityId } });
    await fastify.audit('DOCTOR_AVAILABILITY_DELETED', 'DoctorAvailability', availabilityId, {});
    return ok({ deleted: true });
  });

  // ── Day-off CRUD ──────────────────────────────────────────────────────────────────────────────
  fastify.get('/day-off', anyRole, async (req) => {
    const rows = await prisma.dayOff.findMany({ where: { clinicId: req.clinicId! }, orderBy: { date: 'asc' } });
    return ok({ dayOffs: rows });
  });

  fastify.post('/day-off', anyRole, async (req, reply) => {
    const body = parse(CreateDayOffInput, req.body);
    const clinicId = req.clinicId!;
    // RBAC: CLINIC scope → ADMIN only; DOCTOR scope → that doctor (self) or ADMIN.
    if (body.scope === 'CLINIC') {
      if (!(await callerIsAdmin(req))) throw new ForbiddenError('Only an admin can block clinic days');
    } else {
      if (!((await callerIsAdmin(req)) || (req.role === 'DOCTOR' && body.doctorId === req.user!.id))) {
        throw new ForbiddenError('Only an admin or the doctor themselves can block a doctor day');
      }
    }

    const start = body.date;
    const end = body.endDate ?? body.date;
    // Block creation if scheduled appointments exist in the range — force resolution first.
    const rangeEnd = new Date(end.getTime() + DAY_MS);
    const clash = await prisma.appointment.findMany({
      where: {
        clinicId,
        status: { in: ['SCHEDULED', 'CHECKED_IN'] },
        startsAt: { gte: start, lt: rangeEnd },
        ...(body.scope === 'DOCTOR' && body.doctorId ? { doctorId: body.doctorId } : {}),
      },
      include: APPOINTMENT_INCLUDE,
    });
    if (clash.length > 0) {
      throw new AppError('Appointments exist in the blocked range', 409, 'DAY_OFF_HAS_APPOINTMENTS', {
        appointments: clash.map(serializeAppointment),
      });
    }

    const row = await prisma.dayOff.create({
      data: {
        clinicId,
        date: start,
        endDate: body.endDate ?? null,
        scope: body.scope,
        doctorId: body.scope === 'DOCTOR' ? (body.doctorId ?? null) : null,
        reason: body.reason ?? null,
        createdById: req.user!.id,
      },
    });
    await fastify.audit('DAY_OFF_CREATED', 'DayOff', row.id, { scope: body.scope, date: start.toISOString() });
    reply.status(201);
    return ok({ dayOff: row });
  });

  fastify.delete('/day-off/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const existing = await prisma.dayOff.findFirst({ where: { id, clinicId } });
    if (!existing) throw new NotFoundError('Day off not found');
    if (!((await callerIsAdmin(req)) || existing.createdById === req.user!.id)) {
      throw new ForbiddenError('Only the creator or an admin can delete this day off');
    }
    await prisma.dayOff.delete({ where: { id } });
    await fastify.audit('DAY_OFF_DELETED', 'DayOff', id, {});
    return ok({ deleted: true });
  });
}
