import type { FastifyInstance } from 'fastify';
import {
  CreatePatientInput,
  UpdatePatientInput,
  PatientListQuery,
  UpsertToothInput,
  type ToothHistoryEntry,
} from '@odovox/types';
import type { Prisma } from '@odovox/db';
import type { HistoryEntry } from '@odovox/types';
import { NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { encryptField, decryptField } from '../lib/encryption.js';
import { requireRole } from '../lib/rbac.js';
import { createWithUniquePatientCode } from '../lib/patient-code.js';
import { toPatientListItem, toPatientResponse } from '../lib/serialize.js';
import { isClinicalRole } from '../lib/clinical-role.js';
import { billDescription, paymentContext } from '../lib/billing/bill-context.js';

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
    // Queue state lives on the VISIT. `where.status = 'IN_CHAIR'` matched nothing, ever,
    // because no code path writes that value to the patient row.
    if (q.filter === 'in_chair') where.visits = { some: { status: 'IN_CHAIR' } };
    else if (q.filter === 'recent') {
      where.lastVisitAt = { gte: new Date(Date.now() - 30 * 864e5) };
      orderBy = { lastVisitAt: 'desc' };
    } else if (q.filter === 'due_today') {
      where.appointments = { some: { startsAt: { gte: startOfToday(), lte: endOfToday() } } };
    } else if (q.filter === 'lab_pending') {
      where.labCases = { some: { status: { notIn: ['COMPLETED', 'CANCELLED'] } } };
    }

    const rows = await prisma.patient.findMany({
      where,
      orderBy,
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
      // Narrow includes: existence only. `take: 1` and a scalar select keep this from
      // becoming a second patient-record endpoint, and no PHI is pulled in.
      include: {
        visits: { where: { status: 'IN_CHAIR' }, select: { id: true }, take: 1 },
        labCases: {
          where: { status: { notIn: ['COMPLETED', 'CANCELLED'] } },
          select: { id: true },
          take: 1,
        },
      },
    });
    const hasMore = rows.length > q.limit;
    const items = rows.slice(0, q.limit).map((p) =>
      // In the chair outranks a pending lab case: it is where the patient physically is,
      // and only one ring can be drawn.
      toPatientListItem(p, p.visits.length ? 'IN_CHAIR' : p.labCases.length ? 'LAB_PENDING' : null),
    );
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
    // Reception keeps the record — they book, bill and phone from it — without the
    // clinical half of it (ruling B1).
    return ok(toPatientResponse(patient, isClinicalRole(req.role)));
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
    return ok(toPatientResponse(updated, isClinicalRole(req.role)));
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
  /**
   * Frame 42 — the patient's timeline.
   *
   * Assembled from records that already exist rather than a new table: visits carry the
   * date and doctor, their consultation says whether a clinical record was actually
   * confirmed, bills carry what was charged, and prescriptions count against the visit.
   *
   * The clinical boundary applies here too (rulings B1/B4). A recorded allergy is a
   * medical fact, so it is only assembled for clinical roles — a receptionist gets the
   * operational timeline, which is what they book and bill from, and no medical facts.
   */
  fastify.get('/patients/:id/history', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const patient = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');

    const visits = await prisma.visit.findMany({
      where: { patientId: id, deletedAt: null, status: { in: ['COMPLETED', 'CHECKOUT'] } },
      orderBy: [{ startedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        doctor: { select: { name: true } },
        consultation: { select: { status: true, structuredData: true } },
        bills: { select: { totalPaise: true } },
        prescriptions: { select: { id: true } },
      },
    });

    const entries: HistoryEntry[] = visits.map((v): HistoryEntry => {
      const data = (v.consultation?.structuredData ?? {}) as {
        procedure?: string | null;
        teeth?: number[];
        sittingCurrent?: number | null;
      };
      const sitting = data.sittingCurrent != null ? ` · Sitting ${data.sittingCurrent}` : '';
      return {
        id: v.id,
        kind: 'visit' as const,
        at: v.startedAt ?? v.completedAt ?? v.createdAt,
        title: `${data.procedure ?? v.chiefComplaint ?? 'Visit'}${sitting}`,
        teeth: Array.isArray(data.teeth) ? data.teeth : [],
        feePaise: v.bills.length ? v.bills.reduce((n, b) => n + b.totalPaise, 0) : null,
        doctorName: v.doctor?.name ?? null,
        confirmed: v.consultation?.status === 'CONFIRMED',
        prescriptionCount: v.prescriptions.length,
        detail: null,
      };
    });

    // The permanent facts. Only for roles entitled to clinical detail — this is the same
    // allergy information withheld from reception everywhere else, and a timeline is not a
    // loophole in that boundary.
    if (isClinicalRole(req.role)) {
      // Decrypt only here, inside the clinical-role branch — reception's request never
      // reaches this line, so the plaintext is never even materialised for them.
      const allergies = patient.allergiesEnc ? decryptField(patient.allergiesEnc) : null;
      if (allergies && allergies.trim() && !/^none/i.test(allergies.trim())) {
        entries.push({
          id: `fact-allergy-${patient.id}`,
          kind: 'fact' as const,
          // No recorded date exists for an allergy — the column is free text with no
          // timestamp — so it is null rather than a guessed year (see deviations).
          at: null,
          title: `${allergies.trim()} allergy recorded`,
          teeth: [],
          feePaise: null,
          doctorName: null,
          confirmed: false,
          prescriptionCount: 0,
          detail: 'applies to every Rx',
        });
      }
    }

    return ok({ entries });
  });

  fastify.get('/patients/:id/billing', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const patient = await prisma.patient.findFirst({ where: { id, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');
    // Additive read model for frame 41: what each bill was FOR, and when/how it was paid.
    // Both derive from records that already exist — BillItem.description and Payment — so
    // there is no second billing source of truth and nothing new is stored. Narrow selects:
    // only the columns the derivation reads.
    const bills = await prisma.bill.findMany({
      where: { patientId: id },
      orderBy: { createdAt: 'desc' },
      include: {
        items: { select: { description: true, subtotalPaise: true } },
        payments: {
          select: { method: true, status: true, receivedAt: true, createdAt: true },
        },
      },
    });
    const totalBilled = bills.reduce((s, b) => s + b.totalPaise, 0);
    const totalPaid = bills.reduce((s, b) => s + b.paidPaise, 0);
    return ok({
      summary: { totalBilledPaise: totalBilled, totalPaidPaise: totalPaid, outstandingPaise: patient.outstandingPaise },
      bills: bills.map((b) => {
        const payment = paymentContext(b.payments);
        return {
          id: b.id,
          visitId: b.visitId,
          billNumber: b.billNumber,
          totalPaise: b.totalPaise,
          paidPaise: b.paidPaise,
          balancePaise: b.balancePaise,
          status: b.status,
          createdAt: b.createdAt,
          // Null rather than a guess wherever the records cannot answer.
          description: billDescription(b.items),
          payment,
        };
      }),
    });
  });
}
