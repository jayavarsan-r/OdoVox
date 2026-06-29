import type { FastifyInstance } from 'fastify';
import {
  CreateTreatmentPlanInput,
  UpdateTreatmentPlanInput,
  CreateManualVisitInput,
  CreatePrescriptionInput,
  type Medicine,
} from '@odovox/types';
import { z } from 'zod';
import type { Patient, Prisma } from '@odovox/db';
import { AppError, ForbiddenError, NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { decryptField } from '../lib/encryption.js';
import { requireRole } from '../lib/rbac.js';
import { storage } from '../lib/storage.js';
import { generatePrescriptionPdf } from '../lib/prescription-pdf.js';
import { generateTreatmentPlanPdf } from '../lib/treatment-plan-pdf.js';
import { broadcastToClinic } from '../lib/realtime/broadcast.js';
import { APPOINTMENT_INCLUDE, serializeAppointment } from '../lib/schedule/serialize.js';

const CancelPlanInput = z.object({ reason: z.string().min(1).max(500) });

function planProgress(procedures: { totalSittings: number; completedSittings: number }[]) {
  const totalSittings = procedures.reduce((s, p) => s + p.totalSittings, 0);
  const completedSittings = procedures.reduce((s, p) => s + p.completedSittings, 0);
  const percent = totalSittings === 0 ? 0 : Math.round((completedSittings / totalSittings) * 100);
  return { totalSittings, completedSittings, percent };
}

export async function clinicalRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const doctorOnly = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] };

  /** Verify a patient exists in the caller's clinic (clinic-scoped read). */
  const assertPatient = async (id: string): Promise<Patient> => {
    const patient = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');
    return patient;
  };

  // ===== Treatment plans =====================================================
  fastify.get('/patients/:id/plans', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    await assertPatient(id);
    const plans = await prisma.treatmentPlan.findMany({
      where: { patientId: id, deletedAt: null },
      include: { procedures: true },
      orderBy: { createdAt: 'desc' },
    });
    return ok(
      plans.map((p) => ({
        id: p.id,
        patientId: p.patientId,
        name: p.name,
        description: p.description,
        status: p.status,
        estimatedCostPaise: p.estimatedCostPaise,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        teeth: [...new Set(p.procedures.flatMap((proc) => proc.toothNumbers))],
        progress: planProgress(p.procedures),
      })),
    );
  });

  fastify.post('/patients/:id/plans', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    await assertPatient(id);
    const input = parse(CreateTreatmentPlanInput, { ...(req.body as object), patientId: id });
    const plan = await prisma.treatmentPlan.create({
      data: {
        patientId: id,
        name: input.name,
        description: input.description ?? null,
        estimatedCostPaise: input.estimatedCostPaise,
        status: input.procedures.length > 0 ? 'ACTIVE' : 'DRAFT',
        createdById: req.user!.id,
        procedures: {
          create: input.procedures.map((proc) => ({
            name: proc.name,
            toothNumbers: proc.toothNumbers,
            totalSittings: proc.totalSittings,
            notes: proc.notes ?? null,
          })),
        },
      },
      include: { procedures: true },
    });
    if (await prisma.patient.findFirst({ where: { id, status: 'NEW' } })) {
      await prisma.patient.update({ where: { id }, data: { status: 'ACTIVE' } });
    }
    await fastify.audit('TREATMENT_PLAN_CREATED', 'TreatmentPlan', plan.id);
    return ok({ ...plan, progress: planProgress(plan.procedures) });
  });

  // Detail: full nested structure — procedures → sittings (visit date + decrypted notes), plus
  // prescriptions and x-rays across the plan's sitting visits.
  fastify.get('/plans/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id },
      include: {
        patient: true,
        procedures: { include: { sittings: { include: { visit: true }, orderBy: { sittingNumber: 'asc' } } } },
      },
    });
    if (!plan || plan.deletedAt || plan.patient.clinicId !== req.clinicId) {
      throw new NotFoundError('Plan not found');
    }

    const visitIds = plan.procedures
      .flatMap((p) => p.sittings.map((s) => s.visitId))
      .filter((v): v is string => Boolean(v));
    const [prescriptions, xrayCount] = await Promise.all([
      visitIds.length
        ? prisma.prescription.findMany({
            where: { visitId: { in: visitIds }, deletedAt: null },
            orderBy: { createdAt: 'asc' },
          })
        : Promise.resolve([]),
      visitIds.length
        ? prisma.media.count({ where: { visitId: { in: visitIds }, type: 'XRAY', deletedAt: null } })
        : Promise.resolve(0),
    ]);

    const { patient: _patient, procedures, ...rest } = plan;
    return ok({
      ...rest,
      progress: planProgress(procedures),
      procedures: procedures.map((p) => ({
        id: p.id,
        name: p.name,
        toothNumbers: p.toothNumbers,
        totalSittings: p.totalSittings,
        completedSittings: p.completedSittings,
        status: p.status,
        sittings: p.sittings.map((s) => ({
          id: s.id,
          sittingNumber: s.sittingNumber,
          date: s.visit?.startedAt ?? s.completedAt ?? s.createdAt,
          completed: s.completedAt != null,
          notes: s.notesEnc ? decryptField(s.notesEnc) : null,
          visitId: s.visitId,
        })),
      })),
      prescriptions,
      xrayCount,
    });
  });

  // Mark a plan complete: plan + all its procedures → COMPLETED (audit logged).
  fastify.post('/plans/:id/complete', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.treatmentPlan.findUnique({ where: { id }, include: { patient: true } });
    if (!plan || plan.deletedAt || plan.patient.clinicId !== req.clinicId) throw new NotFoundError('Plan not found');
    if (plan.status === 'CANCELLED') throw new AppError('Cannot complete a cancelled plan', 422, 'PLAN_CANCELLED');
    await prisma.$transaction([
      prisma.treatmentPlan.update({ where: { id }, data: { status: 'COMPLETED', completedAt: new Date() } }),
      prisma.procedure.updateMany({ where: { planId: id, status: { not: 'CANCELLED' } }, data: { status: 'COMPLETED' } }),
    ]);
    await fastify.audit('TREATMENT_PLAN_COMPLETED', 'TreatmentPlan', id);
    return ok({ id, status: 'COMPLETED' });
  });

  // Cancel a plan with a reason: plan + sub-procedures → CANCELLED. Only the plan's doctor (or an
  // admin) may cancel. Future consultations then start a new plan instead of continuing this one.
  fastify.post('/plans/:id/cancel', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const { reason } = parse(CancelPlanInput, req.body);
    const plan = await prisma.treatmentPlan.findUnique({ where: { id }, include: { patient: true } });
    if (!plan || plan.deletedAt || plan.patient.clinicId !== req.clinicId) throw new NotFoundError('Plan not found');
    if (req.role !== 'ADMIN' && plan.createdById && plan.createdById !== req.user!.id) {
      throw new ForbiddenError('Only the doctor on this plan can cancel it');
    }
    // Phase 6 (§6.3): cancelling a plan auto-cancels its remaining SCHEDULED appointments (never
    // COMPLETED/past ones). Capture them first so we can broadcast each after commit.
    const futureAppts = await prisma.appointment.findMany({
      where: { clinicId: req.clinicId!, treatmentPlanId: id, status: 'SCHEDULED', deletedAt: null },
      select: { id: true },
    });
    const apptIds = futureAppts.map((a) => a.id);

    await prisma.$transaction([
      prisma.treatmentPlan.update({
        where: { id },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancellationReason: reason },
      }),
      prisma.procedure.updateMany({ where: { planId: id }, data: { status: 'CANCELLED' } }),
      prisma.appointment.updateMany({
        where: { id: { in: apptIds } },
        data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledById: req.user!.id, cancellationReason: 'Treatment plan cancelled.' },
      }),
      prisma.appointmentReminder.updateMany({
        where: { appointmentId: { in: apptIds }, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      }),
    ]);
    await fastify.audit('TREATMENT_PLAN_CANCELLED', 'TreatmentPlan', id, { reason, cancelledAppointments: apptIds.length });

    // Broadcast each cancelled appointment so the calendars update in real time.
    for (const apptId of apptIds) {
      const full = await prisma.appointment.findFirst({ where: { id: apptId, clinicId: req.clinicId! }, include: APPOINTMENT_INCLUDE });
      if (full) broadcastToClinic(req.clinicId!, { type: 'schedule.appointment.cancelled', payload: serializeAppointment(full) });
    }
    return ok({ id, status: 'CANCELLED', cancelledAppointments: apptIds.length });
  });

  fastify.patch('/plans/:id', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(UpdateTreatmentPlanInput, req.body);
    const plan = await prisma.treatmentPlan.findUnique({ where: { id }, include: { patient: true } });
    if (!plan || plan.patient.clinicId !== req.clinicId) throw new NotFoundError('Plan not found');
    const data: Prisma.TreatmentPlanUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.estimatedCostPaise !== undefined) data.estimatedCostPaise = input.estimatedCostPaise;
    if (input.status !== undefined) data.status = input.status;
    const updated = await prisma.treatmentPlan.update({ where: { id }, data, include: { procedures: true } });
    await fastify.audit('TREATMENT_PLAN_UPDATED', 'TreatmentPlan', id, { changed: Object.keys(input) });
    return ok({ ...updated, progress: planProgress(updated.procedures) });
  });

  fastify.delete('/plans/:id', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.treatmentPlan.findUnique({ where: { id }, include: { patient: true } });
    if (!plan || plan.patient.clinicId !== req.clinicId) throw new NotFoundError('Plan not found');
    await prisma.treatmentPlan.update({ where: { id }, data: { status: 'CANCELLED' } });
    await fastify.audit('TREATMENT_PLAN_CANCELLED', 'TreatmentPlan', id);
    return ok({ id, status: 'CANCELLED' });
  });

  // ===== Visits ==============================================================
  fastify.get('/patients/:id/visits', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    await assertPatient(id);
    const visits = await prisma.visit.findMany({
      where: { patientId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return ok(visits);
  });

  fastify.post('/patients/:id/visits', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    await assertPatient(id);
    const input = parse(CreateManualVisitInput, req.body);
    const occurredAt = input.occurredAt ?? new Date();
    const count = await prisma.visit.count({});
    const visit = await prisma.visit.create({
      data: {
        clinicId: req.clinicId!,
        patientId: id,
        doctorId: input.doctorId ?? req.user!.id,
        roomId: input.roomId ?? null,
        status: 'COMPLETED',
        manualEntry: true,
        tokenNumber: count + 1,
        chiefComplaint: input.procedure,
        startedAt: occurredAt,
        endedAt: occurredAt,
      },
    });
    await prisma.patient.update({
      where: { id },
      data: { lastVisitAt: occurredAt, status: 'ACTIVE' },
    });
    await fastify.audit('VISIT_CREATED', 'Visit', visit.id, { manual: true, procedure: input.procedure });
    return ok(visit);
  });

  fastify.get('/visits/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const visit = await prisma.visit.findFirst({ where: { id } });
    if (!visit) throw new NotFoundError('Visit not found');
    return ok(visit);
  });

  // ===== Prescriptions =======================================================
  fastify.get('/patients/:id/prescriptions', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    await assertPatient(id);
    const list = await prisma.prescription.findMany({
      where: { patientId: id, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return ok(list);
  });

  fastify.post('/patients/:id/prescriptions', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    await assertPatient(id);
    const input = parse(CreatePrescriptionInput, {
      ...(req.body as object),
      patientId: id,
      doctorId: req.user!.id,
    });
    const prescription = await prisma.prescription.create({
      data: {
        patientId: id,
        visitId: input.visitId ?? null,
        doctorId: req.user!.id,
        medicines: input.medicines as unknown as Prisma.InputJsonValue,
        instructions: input.instructions ?? null,
        reviewAfterDays: input.reviewAfterDays ?? null,
      },
    });
    await fastify.audit('PRESCRIPTION_CREATED', 'Prescription', prescription.id, {
      medicineCount: input.medicines.length,
    });
    return ok(prescription);
  });

  fastify.get('/prescriptions/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const rx = await prisma.prescription.findUnique({ where: { id }, include: { patient: true } });
    if (!rx || rx.deletedAt || rx.patient.clinicId !== req.clinicId) throw new NotFoundError('Prescription not found');
    const { patient: _p, ...rest } = rx;
    return ok(rest);
  });

  fastify.get('/prescriptions/:id/pdf', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const rx = await prisma.prescription.findUnique({ where: { id }, include: { patient: true } });
    if (!rx || rx.patient.clinicId !== req.clinicId) throw new NotFoundError('Prescription not found');

    // Generate + cache on first request.
    let storageKey = rx.pdfStorageKey;
    if (!storageKey) {
      const clinic = await prisma.clinic.findFirst({ where: { id: req.clinicId } });
      const member = await prisma.clinicMember.findFirst({ where: { userId: rx.doctorId } });
      const doctor = await prisma.user.findUnique({ where: { id: rx.doctorId } });
      if (!clinic || !doctor) throw new AppError('Missing clinic/doctor for PDF', 500, 'PDF_CONTEXT_MISSING');
      const pdf = await generatePrescriptionPdf({
        clinicName: clinic.name,
        clinicAddress: `${clinic.addressLine}, ${clinic.city}, ${clinic.state} ${clinic.pincode}`,
        doctorName: doctor.name,
        qualification: member?.qualification ?? null,
        registrationNumber: member?.registrationNumberEnc ? decryptField(member.registrationNumberEnc) : null,
        patientName: rx.patient.name,
        patientAge: rx.patient.age,
        patientGender: rx.patient.gender,
        date: rx.createdAt,
        medicines: rx.medicines as unknown as Medicine[],
        instructions: rx.instructions,
        reviewAfterDays: rx.reviewAfterDays,
      });
      storageKey = `clinics/${req.clinicId}/prescriptions/${rx.id}.pdf`;
      await storage.putObject(storageKey, pdf, 'application/pdf');
      await prisma.prescription.update({ where: { id: rx.id }, data: { pdfStorageKey: storageKey } });
      await fastify.audit('PRESCRIPTION_PDF_GENERATED', 'Prescription', rx.id);
    }
    const url = await storage.getSignedUrl(storageKey, 300);
    return ok({ url });
  });

  // Treatment-plan case sheet PDF. Generated lazily on GET (Phase 4.5 pattern) and cached in S3.
  fastify.get('/plans/:id/pdf', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id },
      include: {
        patient: true,
        procedures: { include: { sittings: { include: { visit: true }, orderBy: { sittingNumber: 'asc' } } } },
      },
    });
    if (!plan || plan.deletedAt || plan.patient.clinicId !== req.clinicId) throw new NotFoundError('Plan not found');

    const visitIds = plan.procedures
      .flatMap((p) => p.sittings.map((s) => s.visitId))
      .filter((v): v is string => Boolean(v));
    const prescriptions = visitIds.length
      ? await prisma.prescription.findMany({ where: { visitId: { in: visitIds }, deletedAt: null }, orderBy: { createdAt: 'asc' } })
      : [];
    const xrayCount = visitIds.length
      ? await prisma.media.count({ where: { visitId: { in: visitIds }, type: 'XRAY', deletedAt: null } })
      : 0;

    const clinic = await prisma.clinic.findFirst({ where: { id: req.clinicId } });
    const doctor = plan.createdById ? await prisma.user.findUnique({ where: { id: plan.createdById } }) : null;
    const member = plan.createdById ? await prisma.clinicMember.findFirst({ where: { userId: plan.createdById } }) : null;
    if (!clinic) throw new AppError('Missing clinic for PDF', 500, 'PDF_CONTEXT_MISSING');

    const pdf = await generateTreatmentPlanPdf({
      clinicName: clinic.name,
      clinicAddress: `${clinic.addressLine}, ${clinic.city}, ${clinic.state} ${clinic.pincode}`,
      doctorName: doctor?.name ?? 'Doctor',
      qualification: member?.qualification ?? null,
      registrationNumber: member?.registrationNumberEnc ? decryptField(member.registrationNumberEnc) : null,
      patientName: plan.patient.name,
      patientAge: plan.patient.age,
      patientGender: plan.patient.gender,
      patientCode: plan.patient.patientCode,
      planName: plan.name,
      status: plan.status,
      estimatedCostPaise: plan.estimatedCostPaise,
      createdAt: plan.createdAt,
      procedures: plan.procedures.map((p) => ({
        name: p.name,
        toothNumbers: p.toothNumbers,
        totalSittings: p.totalSittings,
        completedSittings: p.completedSittings,
        status: p.status,
        sittings: p.sittings.map((s) => ({
          sittingNumber: s.sittingNumber,
          date: s.visit?.startedAt ?? s.completedAt ?? s.createdAt,
          notes: s.notesEnc ? decryptField(s.notesEnc) : null,
          completed: s.completedAt != null,
        })),
      })),
      prescriptions: prescriptions.map((rx) => ({
        date: rx.createdAt,
        medicines: rx.medicines as unknown as PlanRxMedicine[],
      })),
      xrayCount,
    });

    const storageKey = `clinics/${req.clinicId}/plans/${plan.id}.pdf`;
    await storage.putObject(storageKey, pdf, 'application/pdf');
    await fastify.audit('TREATMENT_PLAN_PDF_GENERATED', 'TreatmentPlan', plan.id);
    const url = await storage.getSignedUrl(storageKey, 300);
    return ok({ url });
  });
}

interface PlanRxMedicine {
  name: string;
  dosage?: string;
  frequency?: string;
  durationDays?: number | null;
}
