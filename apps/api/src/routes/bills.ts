import type { FastifyInstance } from 'fastify';
import {
  BillItemInput,
  CancelBillInput,
  CreateBillInput,
  ListBillsQuery,
  ReopenBillInput,
  UpdateBillInput,
  UpdateBillItemInput,
} from '@odovox/types';
import { AppError, NotFoundError, ValidationError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole, requireAdmin } from '../lib/rbac.js';
import { storage } from '../lib/storage.js';
import { buildBillNumber, generateUniqueNumber } from '../lib/billing/numbers.js';
import { buildItemsFromVisit } from '../lib/billing/auto-populate.js';
import { computeLineSubtotal } from '../lib/billing/totals.js';
import { recomputeBillTotals, broadcastBill } from '../lib/billing/service.js';
import { generateBillPdf } from '../lib/billing/bill-pdf.js';
import {
  BILL_DETAIL_INCLUDE,
  BILL_SUMMARY_INCLUDE,
  toBillResponse,
  toBillSummary,
} from '../lib/billing/serialize.js';

export async function billRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const receptionistAdmin = { preHandler: [fastify.authenticate, requireRole('RECEPTIONIST', 'ADMIN')] };
  const adminOnly = { preHandler: [fastify.authenticate, requireAdmin()] };

  // ── Helpers ─────────────────────────────────────────────────────────────────
  async function loadBillOr404(clinicId: string, id: string) {
    const bill = await prisma.bill.findFirst({ where: { id, clinicId, deletedAt: null } });
    if (!bill) throw new NotFoundError('Bill not found');
    return bill;
  }

  async function billDetail(clinicId: string, id: string) {
    const row = await prisma.bill.findFirstOrThrow({ where: { id, clinicId }, include: BILL_DETAIL_INCLUDE });
    return toBillResponse(row);
  }

  function assertDraft(status: string): void {
    if (status !== 'DRAFT') {
      throw new AppError('Bill items can only be edited while the bill is a DRAFT', 409, 'BILL_NOT_DRAFT');
    }
  }

  function itemCreateData(clinicId: string, input: BillItemInput) {
    const subtotalPaise = computeLineSubtotal(input);
    return {
      clinicId,
      kind: input.kind,
      description: input.description,
      sourceType: input.sourceType ?? null,
      sourceId: input.sourceId ?? null,
      quantity: input.quantity,
      unitPricePaise: input.unitPricePaise,
      discountPaise: input.discountPaise,
      subtotalPaise,
      notes: input.notes ?? null,
    };
  }

  // ===========================================================================
  // Bill CRUD
  // ===========================================================================

  fastify.get('/bills', anyRole, async (req) => {
    const q = parse(ListBillsQuery, req.query);
    const clinicId = req.clinicId!;
    const where: Record<string, unknown> = { clinicId, deletedAt: null };
    if (q.status) where.status = q.status;
    if (q.patientId) where.patientId = q.patientId;
    if (q.from || q.to) {
      where.createdAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
    }
    if (q.search) {
      where.OR = [
        { billNumber: { contains: q.search, mode: 'insensitive' } },
        { patientNameSnapshot: { contains: q.search, mode: 'insensitive' } },
      ];
    }
    const rows = await prisma.bill.findMany({
      where,
      include: BILL_SUMMARY_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    const items = rows.slice(0, q.limit).map(toBillSummary);
    return ok({ items, nextCursor: hasMore ? items[items.length - 1]!.id : null });
  });

  fastify.post('/bills', anyRole, async (req, reply) => {
    const body = parse(CreateBillInput, req.body);
    const clinicId = req.clinicId!;
    const patient = await prisma.patient.findFirst({ where: { id: body.patientId, clinicId, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');
    const clinic = await prisma.clinic.findFirstOrThrow({ where: { id: clinicId } });

    let doctorIdSnapshot: string | null = null;
    const autoItems: BillItemInput[] = [];
    if (body.visitId) {
      const visit = await prisma.visit.findFirst({ where: { id: body.visitId, clinicId, deletedAt: null } });
      if (!visit) throw new NotFoundError('Visit not found');
      if (visit.patientId !== patient.id) throw new ValidationError('Visit does not belong to this patient');
      doctorIdSnapshot = visit.assignedDoctorId ?? visit.doctorId;
      const populated = await buildItemsFromVisit(prisma, {
        clinicId,
        visitId: visit.id,
        chargeForMaterials: clinic.chargeForMaterials,
      });
      autoItems.push(...populated);
    }
    const allItems = [...autoItems, ...(body.items ?? [])];

    const billNumber = await generateUniqueNumber(
      buildBillNumber,
      async (c) => !!(await prisma.bill.findFirst({ where: { clinicId, billNumber: c }, select: { id: true } })),
      clinic.joinCode,
      'bill number',
    );

    const bill = await prisma.$transaction(async (tx) => {
      const created = await tx.bill.create({
        data: {
          clinicId,
          patientId: patient.id,
          visitId: body.visitId ?? null,
          billNumber,
          patientNameSnapshot: patient.name,
          patientPhoneSnapshot: patient.phone,
          doctorIdSnapshot,
          gstApplicable: clinic.gstApplicable,
          gstPercent: clinic.gstPercent,
          notes: body.notes ?? null,
          status: 'DRAFT',
          createdById: req.user!.id,
          items: { create: allItems.map((i) => itemCreateData(clinicId, i)) },
        },
      });
      await recomputeBillTotals(tx, created.id);
      await broadcastBill(tx, clinicId, created.id, 'billing.bill.created');
      return created;
    });
    await fastify.audit('BILL_CREATED', 'Bill', bill.id, { billNumber, fromVisit: body.visitId ?? null });
    reply.status(201);
    return ok(await billDetail(clinicId, bill.id));
  });

  fastify.get('/bills/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    await loadBillOr404(req.clinicId!, id);
    return ok(await billDetail(req.clinicId!, id));
  });

  fastify.patch('/bills/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(UpdateBillInput, req.body);
    const clinicId = req.clinicId!;
    const bill = await loadBillOr404(clinicId, id);
    assertDraft(bill.status);
    await prisma.$transaction(async (tx) => {
      await tx.bill.update({
        where: { id },
        data: {
          ...(body.notes !== undefined ? { notes: body.notes } : {}),
          ...(body.discountPaise !== undefined ? { discountPaise: body.discountPaise } : {}),
          ...(body.discountReason !== undefined ? { discountReason: body.discountReason } : {}),
        },
      });
      await recomputeBillTotals(tx, id);
    });
    await fastify.audit('BILL_UPDATED', 'Bill', id, {});
    return ok(await billDetail(clinicId, id));
  });

  // ── Items (DRAFT only) ────────────────────────────────────────────────────
  fastify.post('/bills/:id/items', anyRole, async (req, reply) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const bill = await loadBillOr404(clinicId, id);
    assertDraft(bill.status);
    const body = parse(BillItemInput, req.body);
    await prisma.$transaction(async (tx) => {
      await tx.billItem.create({ data: { billId: id, ...itemCreateData(clinicId, body) } });
      await recomputeBillTotals(tx, id);
    });
    await fastify.audit('BILL_ITEM_ADDED', 'Bill', id, { description: body.description });
    reply.status(201);
    return ok(await billDetail(clinicId, id));
  });

  fastify.patch('/bills/:id/items/:itemId', anyRole, async (req) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    const clinicId = req.clinicId!;
    const bill = await loadBillOr404(clinicId, id);
    assertDraft(bill.status);
    const existing = await prisma.billItem.findFirst({ where: { id: itemId, billId: id, clinicId } });
    if (!existing) throw new NotFoundError('Bill item not found');
    const body = parse(UpdateBillItemInput, req.body);
    const merged = {
      kind: body.kind ?? existing.kind,
      description: body.description ?? existing.description,
      sourceType: (body.sourceType ?? existing.sourceType ?? undefined) as BillItemInput['sourceType'],
      sourceId: body.sourceId ?? existing.sourceId ?? undefined,
      quantity: body.quantity ?? existing.quantity,
      unitPricePaise: body.unitPricePaise ?? existing.unitPricePaise,
      discountPaise: body.discountPaise ?? existing.discountPaise,
      notes: body.notes ?? existing.notes ?? undefined,
    } satisfies BillItemInput;
    await prisma.$transaction(async (tx) => {
      await tx.billItem.update({ where: { id: itemId }, data: itemCreateData(clinicId, merged) });
      await recomputeBillTotals(tx, id);
    });
    await fastify.audit('BILL_ITEM_UPDATED', 'Bill', id, { itemId });
    return ok(await billDetail(clinicId, id));
  });

  fastify.delete('/bills/:id/items/:itemId', anyRole, async (req) => {
    const { id, itemId } = req.params as { id: string; itemId: string };
    const clinicId = req.clinicId!;
    const bill = await loadBillOr404(clinicId, id);
    assertDraft(bill.status);
    const existing = await prisma.billItem.findFirst({ where: { id: itemId, billId: id, clinicId } });
    if (!existing) throw new NotFoundError('Bill item not found');
    await prisma.$transaction(async (tx) => {
      await tx.billItem.delete({ where: { id: itemId } });
      await recomputeBillTotals(tx, id);
    });
    await fastify.audit('BILL_ITEM_REMOVED', 'Bill', id, { itemId });
    return ok(await billDetail(clinicId, id));
  });

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  fastify.post('/bills/:id/finalize', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const bill = await loadBillOr404(clinicId, id);
    if (bill.status !== 'DRAFT') throw new AppError('Only a DRAFT bill can be finalized', 409, 'BILL_NOT_DRAFT');
    const patient = await prisma.patient.findFirstOrThrow({ where: { id: bill.patientId } });
    await prisma.$transaction(async (tx) => {
      await recomputeBillTotals(tx, id);
      await tx.bill.update({
        where: { id },
        data: {
          status: 'FINALIZED',
          finalizedAt: new Date(),
          patientNameSnapshot: patient.name,
          patientPhoneSnapshot: patient.phone,
        },
      });
      await broadcastBill(tx, clinicId, id, 'billing.bill.finalized');
    });
    await fastify.audit('BILL_FINALIZED', 'Bill', id, { billNumber: bill.billNumber });
    return ok(await billDetail(clinicId, id));
  });

  fastify.post('/bills/:id/reopen', adminOnly, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const body = parse(ReopenBillInput, req.body ?? {});
    const bill = await loadBillOr404(clinicId, id);
    if (bill.status !== 'FINALIZED') {
      throw new AppError('Only a FINALIZED bill with no payments can be reopened', 422, 'BILL_NOT_REOPENABLE');
    }
    if (bill.paidPaise > 0 || bill.refundedPaise > 0) {
      throw new AppError('Refund all payments before reopening this bill', 422, 'BILL_HAS_PAYMENTS');
    }
    await prisma.bill.update({ where: { id }, data: { status: 'DRAFT', finalizedAt: null } });
    await fastify.audit('BILL_REOPENED', 'Bill', id, { reason: body.reason ?? null });
    return ok(await billDetail(clinicId, id));
  });

  fastify.post('/bills/:id/cancel', receptionistAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const body = parse(CancelBillInput, req.body);
    const bill = await loadBillOr404(clinicId, id);
    if (bill.status === 'CANCELLED') throw new AppError('Bill already cancelled', 409, 'BILL_ALREADY_CANCELLED');
    // Net money held (paid minus refunded) must be returned before voiding.
    if (bill.paidPaise - bill.refundedPaise > 0) {
      throw new AppError('Refund the payments on this bill before cancelling', 422, 'BILL_HAS_PAYMENTS');
    }
    await prisma.bill.update({
      where: { id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), cancelledReason: body.reason },
    });
    await fastify.audit('BILL_CANCELLED', 'Bill', id, { reason: body.reason });
    return ok(await billDetail(clinicId, id));
  });

  // ── PDF (lazy generation, cached; Phase 4.5 pattern) ─────────────────────────
  async function ensureBillPdfKey(clinicId: string, id: string): Promise<string> {
    const row = await prisma.bill.findFirstOrThrow({ where: { id, clinicId }, include: BILL_DETAIL_INCLUDE });
    if (row.pdfStorageKey) return row.pdfStorageKey;
    const clinic = await prisma.clinic.findFirstOrThrow({ where: { id: clinicId } });
    const pdf = await generateBillPdf({
      clinicName: clinic.name,
      clinicAddress: `${clinic.addressLine}, ${clinic.city}, ${clinic.state} ${clinic.pincode}`,
      gstNumber: clinic.gstApplicable ? clinic.gstNumber : null,
      billNumber: row.billNumber,
      date: row.finalizedAt ?? row.createdAt,
      patientName: row.patientNameSnapshot || row.patient.name,
      patientPhone: row.patientPhoneSnapshot,
      items: row.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        unitPricePaise: i.unitPricePaise,
        discountPaise: i.discountPaise,
        subtotalPaise: i.subtotalPaise,
      })),
      subtotalPaise: row.subtotalPaise,
      discountPaise: row.discountPaise,
      gstApplicable: row.gstApplicable,
      gstPercent: Number(row.gstPercent),
      gstPaise: row.gstPaise,
      totalPaise: row.totalPaise,
      paidPaise: row.paidPaise,
      balancePaise: row.balancePaise,
      status: row.status,
    });
    const storageKey = `clinics/${clinicId}/bills/${row.id}.pdf`;
    await storage.putObject(storageKey, pdf, 'application/pdf');
    await prisma.bill.update({ where: { id: row.id }, data: { pdfStorageKey: storageKey } });
    await fastify.audit('BILL_PDF_GENERATED', 'Bill', row.id);
    return storageKey;
  }

  fastify.get('/bills/:id/pdf', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    await loadBillOr404(clinicId, id);
    const key = await ensureBillPdfKey(clinicId, id);
    const url = await storage.getSignedUrl(key, 300);
    return ok({ url });
  });

  // POST regenerates (invalidates the cached PDF so item edits reflect).
  fastify.post('/bills/:id/pdf', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    await loadBillOr404(clinicId, id);
    await prisma.bill.update({ where: { id }, data: { pdfStorageKey: null } });
    const key = await ensureBillPdfKey(clinicId, id);
    const url = await storage.getSignedUrl(key, 300);
    return ok({ url });
  });
}
