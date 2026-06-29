import type { FastifyInstance } from 'fastify';
import {
  CreatePatientInput,
  UpdatePatientInput,
  PatientListQuery,
  UpsertToothInput,
  type ToothHistoryEntry,
} from '@odovox/types';
import type { Prisma } from '@odovox/db';
import { NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { encryptField } from '../lib/encryption.js';
import { requireRole } from '../lib/rbac.js';
import { createWithUniquePatientCode } from '../lib/patient-code.js';
import { toPatientListItem, toPatientResponse } from '../lib/serialize.js';

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
};

export async function patientRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const doctorOnly = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] };

  // ---- list -----------------------------------------------------------------
  fastify.get('/patients', anyRole, async (req) => {
    const q = parse(PatientListQuery, req.query);
    const where: Prisma.PatientWhereInput = { deletedAt: null };

    if (q.search) {
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { phone: { contains: q.search } },
        { patientCode: { contains: q.search, mode: 'insensitive' } },
      ];
    }

    let orderBy: Prisma.PatientOrderByWithRelationInput = { createdAt: 'desc' };
    if (q.filter === 'in_chair') where.status = 'IN_CHAIR';
    else if (q.filter === 'recent') {
      where.lastVisitAt = { gte: new Date(Date.now() - 30 * 864e5) };
      orderBy = { lastVisitAt: 'desc' };
    } else if (q.filter === 'due_today') {
      where.appointments = { some: { startsAt: { gte: startOfToday(), lte: endOfToday() } } };
    } else if (q.filter === 'lab_pending') {
      where.labCases = { some: { status: { notIn: ['DELIVERED', 'FITTED', 'REJECTED'] } } };
    }

    const rows = await prisma.patient.findMany({
      where,
      orderBy,
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    const items = rows.slice(0, q.limit).map(toPatientListItem);
    return ok({ items, nextCursor: hasMore ? items[items.length - 1]!.id : null });
  });

  // ---- create ---------------------------------------------------------------
  fastify.post('/patients', anyRole, async (req) => {
    const input = parse(CreatePatientInput, req.body);
    const { result: patient, patientCode } = await createWithUniquePatientCode(
      (code) =>
        prisma.patient.create({
          data: {
            clinicId: req.clinicId!,
            patientCode: code,
            name: input.name,
            phone: input.phone,
            age: input.age,
            gender: input.gender,
            bloodGroup: input.bloodGroup ?? null,
            addressEnc: input.address ? encryptField(input.address) : null,
            medicalHistoryEnc: input.medicalHistory ? encryptField(input.medicalHistory) : null,
            allergiesEnc: input.allergies ? encryptField(input.allergies) : null,
            chiefComplaint: input.chiefComplaint ?? null,
            medicalFlags: input.medicalFlags,
            status: 'NEW',
            createdById: req.user!.id,
          },
        }),
      input.patientCode,
    );
    await fastify.audit('PATIENT_CREATED', 'Patient', patient.id, { patientCode });
    return ok(toPatientResponse(patient));
  });

  // ---- detail ---------------------------------------------------------------
  fastify.get('/patients/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const patient = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');
    return ok(toPatientResponse(patient));
  });

  // ---- update ---------------------------------------------------------------
  fastify.patch('/patients/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const input = parse(UpdatePatientInput, req.body);
    const existing = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundError('Patient not found');

    const data: Prisma.PatientUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.phone !== undefined) data.phone = input.phone;
    if (input.age !== undefined) data.age = input.age;
    if (input.gender !== undefined) data.gender = input.gender;
    if (input.bloodGroup !== undefined) data.bloodGroup = input.bloodGroup ?? null;
    if (input.chiefComplaint !== undefined) data.chiefComplaint = input.chiefComplaint ?? null;
    if (input.medicalFlags !== undefined) data.medicalFlags = input.medicalFlags;
    if (input.status !== undefined) data.status = input.status;
    if (input.address !== undefined) data.addressEnc = input.address ? encryptField(input.address) : null;
    if (input.medicalHistory !== undefined)
      data.medicalHistoryEnc = input.medicalHistory ? encryptField(input.medicalHistory) : null;
    if (input.allergies !== undefined)
      data.allergiesEnc = input.allergies ? encryptField(input.allergies) : null;

    const updated = await prisma.patient.update({ where: { id }, data });
    await fastify.audit('PATIENT_UPDATED', 'Patient', id, { changedFields: Object.keys(input) });
    return ok(toPatientResponse(updated));
  });

  // ---- soft delete (doctor/admin only) --------------------------------------
  fastify.delete('/patients/:id', doctorOnly, async (req) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundError('Patient not found');
    await prisma.patient.update({ where: { id }, data: { deletedAt: new Date() } });
    await fastify.audit('PATIENT_DELETED', 'Patient', id);
    return ok({ deletedAt: new Date().toISOString() });
  });

  // ---- teeth ----------------------------------------------------------------
  fastify.get('/patients/:id/teeth', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const patient = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');
    // ToothRecord is not clinic-scoped; scope via patientId (already clinic-verified above).
    const teeth = await prisma.toothRecord.findMany({ where: { patientId: id } });
    return ok(
      teeth.map((t) => ({
        id: t.id,
        patientId: t.patientId,
        toothNumber: t.toothNumber,
        status: t.status,
        notes: t.notes ?? null,
        history: Array.isArray(t.history) ? t.history : [],
        updatedAt: t.updatedAt,
      })),
    );
  });

  fastify.put('/patients/:id/teeth/:tooth', doctorOnly, async (req) => {
    const { id, tooth } = req.params as { id: string; tooth: string };
    const toothNumber = Number(tooth);
    const input = parse(UpsertToothInput, req.body);
    const patient = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');

    const existing = await prisma.toothRecord.findFirst({
      where: { patientId: id, toothNumber },
    });
    const entry: ToothHistoryEntry = {
      date: new Date().toISOString(),
      status: input.status,
      by: req.user!.id,
      notes: input.notes ?? null,
    };
    const history: ToothHistoryEntry[] = [
      ...((existing?.history as ToothHistoryEntry[] | null) ?? []),
      entry,
    ];

    const record = existing
      ? await prisma.toothRecord.update({
          where: { id: existing.id },
          data: { status: input.status, notes: input.notes ?? null, lastUpdatedById: req.user!.id, history },
        })
      : await prisma.toothRecord.create({
          data: {
            patientId: id,
            toothNumber,
            status: input.status,
            notes: input.notes ?? null,
            lastUpdatedById: req.user!.id,
            history,
          },
        });
    await fastify.audit('TOOTH_UPDATED', 'ToothRecord', record.id, { toothNumber, status: input.status });
    return ok({ id: record.id, toothNumber, status: record.status, history });
  });

  // ---- billing rollup -------------------------------------------------------
  fastify.get('/patients/:id/billing', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const patient = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');
    const bills = await prisma.bill.findMany({ where: { patientId: id }, orderBy: { createdAt: 'desc' } });
    const totalBilled = bills.reduce((s, b) => s + b.totalPaise, 0);
    const totalPaid = bills.reduce((s, b) => s + b.paidPaise, 0);
    return ok({
      summary: { totalBilledPaise: totalBilled, totalPaidPaise: totalPaid, outstandingPaise: patient.outstandingPaise },
      bills: bills.map((b) => ({
        id: b.id,
        visitId: b.visitId,
        totalPaise: b.totalPaise,
        paidPaise: b.paidPaise,
        status: b.status,
        createdAt: b.createdAt,
      })),
    });
  });
}
