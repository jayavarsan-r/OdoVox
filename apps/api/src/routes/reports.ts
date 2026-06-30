import type { FastifyInstance } from 'fastify';
import type { PaymentMethod } from '@odovox/db';
import { DailyCollectionQuery, OutstandingQuery, PatientStatementQuery } from '@odovox/types';
import { ok, parse } from '../lib/http.js';
import { requireReceptionistOrAdmin } from '../lib/rbac.js';
import { NotFoundError } from '../lib/errors.js';
import { storage } from '../lib/storage.js';
import { localDateISO, localDateTimeToUtc } from '../lib/schedule/tz.js';
import { generatePatientStatementPdf, type StatementLine } from '../lib/billing/statement-pdf.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function reportRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const reportAccess = { preHandler: [fastify.authenticate, requireReceptionistOrAdmin()] };

  async function clinicTz(clinicId: string): Promise<string> {
    const c = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { timezone: true } });
    return c.timezone;
  }

  // GET /reports/daily-collection?date=YYYY-MM-DD — receptionist dashboard.
  fastify.get('/reports/daily-collection', reportAccess, async (req) => {
    const q = parse(DailyCollectionQuery, req.query);
    const clinicId = req.clinicId!;
    const tz = await clinicTz(clinicId);
    const date = q.date ?? localDateISO(new Date(), tz);
    const start = localDateTimeToUtc(date, '00:00', tz);
    const end = new Date(start.getTime() + DAY_MS);

    const payments = await prisma.payment.findMany({
      where: { clinicId, status: 'SUCCEEDED', receivedAt: { gte: start, lt: end } },
      include: { bill: { select: { doctorIdSnapshot: true } } },
    });
    const byMethod: Partial<Record<PaymentMethod, number>> = {};
    const byDoctorMap = new Map<string, number>();
    let totalCollectedPaise = 0;
    for (const p of payments) {
      totalCollectedPaise += p.amountPaise;
      byMethod[p.method] = (byMethod[p.method] ?? 0) + p.amountPaise;
      const doc = p.bill?.doctorIdSnapshot;
      if (doc) byDoctorMap.set(doc, (byDoctorMap.get(doc) ?? 0) + p.amountPaise);
    }
    const doctors = await prisma.user.findMany({ where: { id: { in: [...byDoctorMap.keys()] } }, select: { id: true, name: true } });
    const nameOf = new Map(doctors.map((d) => [d.id, d.name]));
    const byDoctor = [...byDoctorMap.entries()]
      .map(([doctorId, totalPaise]) => ({ doctorId, name: nameOf.get(doctorId) ?? 'Unknown', totalPaise }))
      .sort((a, b) => b.totalPaise - a.totalPaise);

    const refunds = await prisma.refund.findMany({
      where: { clinicId, createdAt: { gte: start, lt: end } },
      select: { amountPaise: true },
    });
    const totalRefundedPaise = refunds.reduce((s, r) => s + r.amountPaise, 0);

    return ok({
      date,
      totalCollectedPaise,
      byMethod,
      byDoctor,
      transactionCount: payments.length,
      refundsCount: refunds.length,
      totalRefundedPaise,
    });
  });

  // GET /reports/outstanding?asOf=YYYY-MM-DD&doctorId= — patients with a balance, oldest first.
  fastify.get('/reports/outstanding', reportAccess, async (req) => {
    const q = parse(OutstandingQuery, req.query);
    const clinicId = req.clinicId!;
    const tz = await clinicTz(clinicId);
    const asOf = q.asOf ?? localDateISO(new Date(), tz);
    const end = new Date(localDateTimeToUtc(asOf, '00:00', tz).getTime() + DAY_MS);

    const bills = await prisma.bill.findMany({
      where: {
        clinicId,
        deletedAt: null,
        balancePaise: { gt: 0 },
        status: { in: ['FINALIZED', 'PARTIAL'] },
        createdAt: { lt: end },
        ...(q.doctorId ? { doctorIdSnapshot: q.doctorId } : {}),
      },
      select: { patientId: true, patientNameSnapshot: true, balancePaise: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const map = new Map<string, { name: string; balancePaise: number; oldestBillDate: Date; billCount: number }>();
    for (const b of bills) {
      const cur = map.get(b.patientId);
      if (cur) {
        cur.balancePaise += b.balancePaise;
        cur.billCount += 1;
      } else {
        map.set(b.patientId, { name: b.patientNameSnapshot, balancePaise: b.balancePaise, oldestBillDate: b.createdAt, billCount: 1 });
      }
    }
    const patients = [...map.entries()]
      .map(([patientId, v]) => ({ patientId, ...v }))
      .sort((a, b) => a.oldestBillDate.getTime() - b.oldestBillDate.getTime());
    const totalOutstandingPaise = patients.reduce((s, p) => s + p.balancePaise, 0);
    return ok({ asOf, totalOutstandingPaise, patients });
  });

  // GET /reports/patient-statement?patientId=&from=&to= — generates a statement PDF.
  fastify.get('/reports/patient-statement', reportAccess, async (req) => {
    const q = parse(PatientStatementQuery, req.query);
    const clinicId = req.clinicId!;
    const patient = await prisma.patient.findFirst({ where: { id: q.patientId, clinicId, deletedAt: null } });
    if (!patient) throw new NotFoundError('Patient not found');
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });
    const to = q.to ?? new Date();
    const from = q.from ?? new Date(to.getTime() - 365 * DAY_MS);

    const bills = await prisma.bill.findMany({
      where: { clinicId, patientId: q.patientId, deletedAt: null, createdAt: { gte: from, lte: to }, status: { not: 'DRAFT' } },
      include: { payments: true, refunds: true },
      orderBy: { createdAt: 'asc' },
    });
    const lines: StatementLine[] = [];
    let totalBilledPaise = 0;
    let totalPaidPaise = 0;
    let totalRefundedPaise = 0;
    for (const b of bills) {
      totalBilledPaise += b.totalPaise;
      lines.push({ date: b.createdAt, ref: b.billNumber, description: 'Bill', debitPaise: b.totalPaise, creditPaise: 0 });
      for (const p of b.payments) {
        if (p.status !== 'SUCCEEDED' && p.status !== 'PARTIAL_REFUND' && p.status !== 'REFUNDED') continue;
        totalPaidPaise += p.amountPaise;
        lines.push({ date: p.receivedAt ?? p.createdAt, ref: p.paymentNumber, description: `Payment (${p.method})`, debitPaise: 0, creditPaise: p.amountPaise });
      }
      for (const r of b.refunds) {
        totalRefundedPaise += r.amountPaise;
        lines.push({ date: r.processedAt ?? r.createdAt, ref: r.refundNumber, description: `Refund (${r.reason})`, debitPaise: r.amountPaise, creditPaise: 0 });
      }
    }
    lines.sort((a, b) => a.date.getTime() - b.date.getTime());
    const outstandingPaise = totalBilledPaise - totalPaidPaise + totalRefundedPaise;

    const pdf = await generatePatientStatementPdf({
      clinicName: clinic.name,
      clinicAddress: `${clinic.addressLine}, ${clinic.city}, ${clinic.state} ${clinic.pincode}`,
      patientName: patient.name,
      patientPhone: patient.phone,
      fromDate: from,
      toDate: to,
      lines,
      totalBilledPaise,
      totalPaidPaise,
      totalRefundedPaise,
      outstandingPaise,
    });
    const key = `clinics/${clinicId}/statements/${q.patientId}-${Date.now()}.pdf`;
    await storage.putObject(key, pdf, 'application/pdf');
    await fastify.audit('PATIENT_STATEMENT_GENERATED', 'Patient', q.patientId, { from: from.toISOString(), to: to.toISOString() });
    const url = await storage.getSignedUrl(key, 300);
    return ok({ url });
  });
}
