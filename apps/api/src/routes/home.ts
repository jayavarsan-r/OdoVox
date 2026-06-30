import type { FastifyInstance } from 'fastify';
import type { NeedsYouItem } from '@odovox/types';
import { ok } from '../lib/http.js';
import { requireRole } from '../lib/rbac.js';
import { labCaseTypeLabel } from '../lib/lab/labels.js';

const DAY = 864e5;

export async function homeRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const doctorOnly = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] };

  // ---- Doctor "Needs you" — evaluates each rule -----------------------------
  fastify.get('/home/needs-you', doctorOnly, async (req) => {
    const items: NeedsYouItem[] = [];
    const now = Date.now();

    // 1. Payment overdue: outstanding balance + last visit > 14 days ago.
    const overdue = await prisma.patient.findMany({
      where: {
        deletedAt: null,
        outstandingPaise: { gt: 0 },
        lastVisitAt: { lt: new Date(now - 14 * DAY) },
      },
      take: 10,
    });
    for (const p of overdue) {
      items.push({
        kind: 'PAYMENT_OVERDUE',
        title: `Payment overdue: ${p.name} ₹${Math.round(p.outstandingPaise / 100)}`,
        patientId: p.id,
        patientName: p.name,
      });
    }

    // 3. Lab cases READY (clinic-scoped).
    const labReady = await prisma.labCase.findMany({
      where: { status: 'READY' },
      include: { patient: true },
      take: 5,
    });
    for (const c of labReady) {
      items.push({
        kind: 'LAB_READY',
        title: `Lab ready: ${c.patient.name} (${labCaseTypeLabel(c.type)})`,
        patientId: c.patientId,
        patientName: c.patient.name,
        href: `/lab/${c.id}`,
      });
    }

    // 3b. Lab cases overdue (sent/in-progress, expected return already passed).
    const labOverdue = await prisma.labCase.findMany({
      where: { status: { in: ['SENT', 'IN_PROGRESS'] }, expectedReturnAt: { lt: new Date(now) } },
      include: { patient: true },
      orderBy: { expectedReturnAt: 'asc' },
      take: 5,
    });
    for (const c of labOverdue) {
      items.push({
        kind: 'LAB_OVERDUE',
        title: `Lab overdue: ${c.patient.name} (${labCaseTypeLabel(c.type)})`,
        patientId: c.patientId,
        patientName: c.patient.name,
        href: `/lab/${c.id}`,
      });
    }

    // 3c. Low-stock inventory items (below reorder level). No patient context.
    const lowStock = await prisma.inventoryItem.findMany({
      where: { isArchived: false, reorderLevel: { gt: 0 } },
      take: 50,
    });
    const belowReorder = lowStock
      .filter((i) => i.currentStock < i.reorderLevel)
      .sort((a, b) => b.reorderLevel - b.currentStock - (a.reorderLevel - a.currentStock))
      .slice(0, 5);
    for (const i of belowReorder) {
      items.push({
        kind: 'LOW_STOCK',
        title: `Low stock: ${i.name} (${i.currentStock}/${i.reorderLevel})`,
        href: `/inventory/${i.id}`,
      });
    }

    // 4. Missed appointments in the last 7 days.
    const missed = await prisma.appointment.findMany({
      where: { status: 'NO_SHOW', startsAt: { gte: new Date(now - 7 * DAY) } },
      include: { patient: true },
      take: 10,
    });
    for (const a of missed) {
      items.push({
        kind: 'MISSED_APPOINTMENT',
        title: `Missed appointment: ${a.patient.name} (${a.procedureHint ?? 'appointment'})`,
        patientId: a.patientId,
        patientName: a.patient.name,
      });
    }

    // 5. Treatment plans stalled (active, untouched 21+ days). Plan is not clinic-scoped,
    //    so we scope through the patient.
    const stalled = await prisma.treatmentPlan.findMany({
      where: {
        status: 'ACTIVE',
        deletedAt: null,
        updatedAt: { lt: new Date(now - 21 * DAY) },
        patient: { clinicId: req.clinicId, deletedAt: null },
      },
      include: { patient: true },
      take: 10,
    });
    for (const pl of stalled) {
      items.push({
        kind: 'TREATMENT_STALLED',
        title: `Treatment stalled: ${pl.patient.name}`,
        patientId: pl.patientId,
        patientName: pl.patient.name,
      });
    }

    return ok({ items });
  });

  // ---- Doctor recent visits -------------------------------------------------
  fastify.get('/home/recent', doctorOnly, async (req) => {
    const visits = await prisma.visit.findMany({
      where: { doctorId: req.user!.id, deletedAt: null },
      include: { patient: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
    return ok({
      items: visits.map((v) => ({
        id: v.id,
        patientId: v.patientId,
        patientName: v.patient.name,
        date: v.createdAt,
        procedureSummary: v.chiefComplaint ?? '—',
        status: v.status,
      })),
    });
  });

  // ---- Today's appointments (empty in Phase 2) ------------------------------
  fastify.get('/home/today', anyRole, async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const appts = await prisma.appointment.findMany({
      where: { startsAt: { gte: start, lte: end } },
      include: { patient: true },
      orderBy: { startsAt: 'asc' },
    });
    return ok({
      items: appts.map((a) => ({
        id: a.id,
        patientId: a.patientId,
        patientName: a.patient.name,
        procedureHint: a.procedureHint,
        startsAt: a.startsAt,
        status: a.status,
      })),
    });
  });

  // ---- Receptionist "Recent activity" — audit-derived consultation, lab & inventory events ----
  const LAB_ACTIONS = ['LAB_CASE_SENT', 'LAB_CASE_RECEIVED', 'LAB_CASE_DELIVERED'];
  const INV_ACTIONS = ['INVENTORY_PURCHASE'];

  fastify.get('/today/activity', anyRole, async (req) => {
    const rows = await prisma.auditLog.findMany({
      where: {
        clinicId: req.clinicId,
        action: {
          in: ['CONSULTATION_CONFIRMED', 'CONSULTATION_CONFIRMED_WITH_WARNING', ...LAB_ACTIONS, ...INV_ACTIONS],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: { user: true },
    });

    // Batch-load the entities the feed copy needs.
    const consultIds = rows.filter((r) => r.action.startsWith('CONSULTATION')).map((r) => r.entityId).filter((id): id is string => !!id);
    const labIds = rows.filter((r) => LAB_ACTIONS.includes(r.action)).map((r) => r.entityId).filter((id): id is string => !!id);
    const itemIds = rows.filter((r) => INV_ACTIONS.includes(r.action)).map((r) => r.entityId).filter((id): id is string => !!id);

    const [consults, labCases, invItems] = await Promise.all([
      prisma.consultation.findMany({ where: { id: { in: consultIds } }, include: { visit: { include: { patient: true } } } }),
      prisma.labCase.findMany({ where: { id: { in: labIds } }, include: { patient: true } }),
      prisma.inventoryItem.findMany({ where: { id: { in: itemIds } } }),
    ]);
    const consultById = new Map(consults.map((c) => [c.id, c]));
    const labById = new Map(labCases.map((c) => [c.id, c]));
    const itemById = new Map(invItems.map((i) => [i.id, i]));

    const items = rows.map((r) => {
      const actorName = r.user?.name ?? 'Someone';
      const base = { id: r.id, at: r.createdAt, withWarning: r.action === 'CONSULTATION_CONFIRMED_WITH_WARNING' };

      if (LAB_ACTIONS.includes(r.action)) {
        const c = r.entityId ? labById.get(r.entityId) : undefined;
        const who = c?.patient.name ?? 'a patient';
        const verb =
          r.action === 'LAB_CASE_SENT'
            ? `${actorName} sent case ${c?.caseNumber ?? ''} (${c ? labCaseTypeLabel(c.type) : 'lab'}) for ${who}`
            : r.action === 'LAB_CASE_RECEIVED'
              ? `Lab case ${c?.caseNumber ?? ''} is ready (${who})`
              : `${c?.caseNumber ?? 'Lab case'} delivered to ${who}`;
        return { ...base, patientId: c?.patientId ?? null, text: verb };
      }

      if (INV_ACTIONS.includes(r.action)) {
        const item = r.entityId ? itemById.get(r.entityId) : undefined;
        const qty = (r.metadata as { quantity?: number })?.quantity ?? 0;
        return { ...base, patientId: null, text: `${actorName} added ${qty} ${item?.unitOfMeasure ?? 'units'} of ${item?.name ?? 'an item'} to inventory` };
      }

      const c = r.entityId ? consultById.get(r.entityId) : undefined;
      const procedure = (r.metadata as { procedure?: string | null })?.procedure ?? 'a consultation';
      const patientName = c?.visit.patient.name ?? 'a patient';
      return { ...base, patientId: c?.visit.patientId ?? null, text: `${actorName} completed ${procedure} on ${patientName}` };
    });
    return ok({ items });
  });

  // ---- Receptionist daily stats ---------------------------------------------
  fastify.get('/today/stats', anyRole, async () => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const [appointmentsToday, patientsSeen, inChair, waiting] = await Promise.all([
      prisma.appointment.count({ where: { startsAt: { gte: start } } }),
      prisma.visit.count({ where: { status: 'COMPLETED', endedAt: { gte: start } } }),
      prisma.visit.count({ where: { status: 'IN_CHAIR' } }),
      prisma.visit.count({ where: { status: 'WAITING' } }),
    ]);
    return ok({ appointmentsToday, patientsSeen, inChair, waiting });
  });
}
