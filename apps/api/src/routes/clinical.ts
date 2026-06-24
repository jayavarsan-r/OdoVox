import type { FastifyInstance } from 'fastify';
import {
  CreateTreatmentPlanInput,
  UpdateTreatmentPlanInput,
  CreateManualVisitInput,
  CreatePrescriptionInput,
  type Medicine,
} from '@odovox/types';
import type { Patient, Prisma } from '@odovox/db';
import { AppError, NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { decryptField } from '../lib/encryption.js';
import { requireRole } from '../lib/rbac.js';
import { storage } from '../lib/storage.js';
import { generatePrescriptionPdf } from '../lib/prescription-pdf.js';

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

  fastify.get('/plans/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const plan = await prisma.treatmentPlan.findUnique({
      where: { id },
      include: { procedures: true, patient: true },
    });
    if (!plan || plan.deletedAt || plan.patient.clinicId !== req.clinicId) {
      throw new NotFoundError('Plan not found');
    }
    const { patient: _patient, procedures, ...rest } = plan;
    return ok({ ...rest, procedures, progress: planProgress(procedures) });
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
}
