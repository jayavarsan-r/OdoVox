import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  AdjustmentInput,
  BankTransferPaymentInput,
  CardManualPaymentInput,
  CashPaymentInput,
  ListPaymentsQuery,
  RazorpayLinkInput,
  UpiManualPaymentInput,
} from '@odovox/types';
import { AppError, NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole, requireAdmin, requireReceptionistOrAdmin } from '../lib/rbac.js';
import { buildPaymentNumber, generateUniqueNumber } from '../lib/billing/numbers.js';
import { broadcastBill, broadcastPayment } from '../lib/billing/service.js';
import { recordManualPayment, type RecordPaymentInput } from '../lib/billing/payment-service.js';
import { toPaymentResponse } from '../lib/billing/serialize.js';
import { getPaymentGateway } from '../lib/payments/index.js';
import { notifyPaymentReceipt } from '../lib/whatsapp/cross-wire.js';

export async function paymentRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const receptionistAdmin = { preHandler: [fastify.authenticate, requireReceptionistOrAdmin()] };
  const adminOnly = { preHandler: [fastify.authenticate, requireAdmin()] };

  async function paymentDetail(clinicId: string, id: string) {
    const row = await prisma.payment.findFirst({ where: { id, clinicId } });
    if (!row) throw new NotFoundError('Payment not found');
    return toPaymentResponse(row);
  }

  /** Shared handler for the manual-payment endpoints. */
  async function handleManual(
    req: FastifyRequest,
    reply: FastifyReply,
    input: Omit<RecordPaymentInput, 'clinicId' | 'userId'>,
  ) {
    const clinicId = req.clinicId!;
    const result = await recordManualPayment(prisma, { ...input, clinicId, userId: req.user!.id });
    if (!result.idempotentReplay) {
      await fastify.audit('PAYMENT_RECEIVED', 'Payment', result.paymentId, {
        billId: input.billId,
        amountPaise: input.amountPaise,
        method: input.method,
      });
      // Phase 9: WhatsApp the patient their receipt (best-effort, consent-gated). ADJUSTMENT rows
      // aren't real money movements, so they're skipped by the caller (they use their own endpoint).
      const payment = await prisma.payment.findFirst({ where: { id: result.paymentId, clinicId } });
      if (payment) {
        await notifyPaymentReceipt(fastify, {
          clinicId,
          patientId: payment.patientId,
          paymentId: payment.id,
          amountPaise: payment.amountPaise,
          receiptNumber: payment.paymentNumber,
        });
      }
      reply.status(201);
    }
    return ok(await paymentDetail(clinicId, result.paymentId));
  }

  // ── Manual payment endpoints (RECEPTIONIST + ADMIN; DOCTOR cannot record money) ──
  fastify.post('/payments/cash', receptionistAdmin, async (req, reply) => {
    const b = parse(CashPaymentInput, req.body);
    return handleManual(req, reply, {
      billId: b.billId, amountPaise: b.amountPaise, idempotencyKey: b.idempotencyKey,
      receivedAt: b.receivedAt ?? null, method: 'CASH',
    });
  });

  fastify.post('/payments/upi-manual', receptionistAdmin, async (req, reply) => {
    const b = parse(UpiManualPaymentInput, req.body);
    return handleManual(req, reply, {
      billId: b.billId, amountPaise: b.amountPaise, idempotencyKey: b.idempotencyKey,
      receivedAt: b.receivedAt ?? null, method: 'UPI_MANUAL', upiId: b.upiId ?? null, upiTxnRef: b.upiTxnRef,
    });
  });

  fastify.post('/payments/card-manual', receptionistAdmin, async (req, reply) => {
    const b = parse(CardManualPaymentInput, req.body);
    return handleManual(req, reply, {
      billId: b.billId, amountPaise: b.amountPaise, idempotencyKey: b.idempotencyKey,
      receivedAt: b.receivedAt ?? null, method: 'CARD_MANUAL',
      cardLast4: b.cardLast4 ?? null, cardNetwork: b.cardNetwork ?? null,
    });
  });

  fastify.post('/payments/bank-transfer', receptionistAdmin, async (req, reply) => {
    const b = parse(BankTransferPaymentInput, req.body);
    return handleManual(req, reply, {
      billId: b.billId, amountPaise: b.amountPaise, idempotencyKey: b.idempotencyKey,
      receivedAt: b.receivedAt ?? null, method: 'BANK_TRANSFER', bankTxnRef: b.bankTxnRef,
    });
  });

  // ── Razorpay payment link (RECEPTIONIST + ADMIN) ──
  // Creates a hosted payment link, saves a PENDING Payment, and returns the short URL. The patient
  // pays remotely; the webhook (POST /webhooks/razorpay) flips the payment to SUCCEEDED.
  fastify.post('/payments/razorpay/link', receptionistAdmin, async (req, reply) => {
    const b = parse(RazorpayLinkInput, req.body);
    const clinicId = req.clinicId!;
    const prior = await prisma.payment.findFirst({ where: { clinicId, idempotencyKey: b.idempotencyKey } });
    if (prior) return ok(await paymentDetail(clinicId, prior.id));

    const bill = await prisma.bill.findFirst({ where: { id: b.billId, clinicId, deletedAt: null } });
    if (!bill) throw new NotFoundError('Bill not found');
    if (bill.status !== 'FINALIZED' && bill.status !== 'PARTIAL') {
      throw new AppError('Bill must be finalized before sending a payment link', 422, 'BILL_NOT_PAYABLE');
    }
    if (b.amountPaise <= 0 || b.amountPaise > bill.balancePaise) {
      throw new AppError('Link amount must be within the outstanding balance', 422, 'PAYMENT_EXCEEDS_BALANCE');
    }
    const patient = await prisma.patient.findFirstOrThrow({ where: { id: bill.patientId }, select: { name: true, phone: true } });
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { name: true, joinCode: true } });

    const paymentNumber = await generateUniqueNumber(
      buildPaymentNumber,
      async (c) => !!(await prisma.payment.findFirst({ where: { clinicId, paymentNumber: c }, select: { id: true } })),
      clinic.joinCode,
      'payment number',
    );
    const gateway = getPaymentGateway(req.log);
    const link = await gateway.createPaymentLink({
      amountPaise: b.amountPaise,
      referenceId: paymentNumber,
      description: `Bill ${bill.billNumber} · ${clinic.name}`,
      customer: { name: patient.name, contact: patient.phone },
      notify: b.notify,
      expiresInHours: b.expiresInHours,
      notes: { billId: bill.id, clinicId },
    });
    const payment = await prisma.payment.create({
      data: {
        clinicId, billId: bill.id, patientId: bill.patientId, paymentNumber,
        amountPaise: b.amountPaise, method: 'RAZORPAY', status: 'PENDING',
        razorpayLinkId: link.linkId, razorpayOrderId: link.orderId,
        idempotencyKey: b.idempotencyKey, receivedById: req.user!.id,
      },
    });
    await prisma.$transaction(async (tx) => broadcastPayment(tx, clinicId, payment.id, 'billing.payment.pending'));
    await fastify.audit('PAYMENT_LINK_CREATED', 'Payment', payment.id, { billId: bill.id, linkId: link.linkId });
    reply.status(201);
    const detail = await paymentDetail(clinicId, payment.id);
    return ok({ ...detail, razorpayShortUrl: link.shortUrl, shortUrl: link.shortUrl, paymentId: payment.id });
  });

  // ── Adjustment (ADMIN only; non-money correction, may be negative) ──
  fastify.post('/payments/adjustment', adminOnly, async (req, reply) => {
    const b = parse(AdjustmentInput, req.body);
    const clinicId = req.clinicId!;
    const result = await prisma.$transaction(async (tx) => {
      const prior = await tx.payment.findFirst({ where: { clinicId, idempotencyKey: b.idempotencyKey } });
      if (prior) return { paymentId: prior.id, replay: true };
      const bill = await tx.bill.findFirst({ where: { id: b.billId, clinicId, deletedAt: null } });
      if (!bill) throw new NotFoundError('Bill not found');
      if (bill.status === 'CANCELLED' || bill.status === 'DRAFT') {
        throw new AppError('Bill must be finalized to adjust', 422, 'BILL_NOT_PAYABLE');
      }
      const clinic = await tx.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { joinCode: true } });
      const paymentNumber = await generateUniqueNumber(
        buildPaymentNumber,
        async (c) => !!(await tx.payment.findFirst({ where: { clinicId, paymentNumber: c }, select: { id: true } })),
        clinic.joinCode,
        'payment number',
      );
      const payment = await tx.payment.create({
        data: {
          clinicId, billId: b.billId, patientId: bill.patientId, paymentNumber,
          amountPaise: b.amountPaise, method: 'ADJUSTMENT', status: 'SUCCEEDED',
          idempotencyKey: b.idempotencyKey, receivedById: req.user!.id, receivedAt: new Date(),
          notes: b.reason,
        },
      });
      // Positive credit reduces balance (counts toward paid); negative increases it.
      const paidPaise = bill.paidPaise + b.amountPaise;
      const balancePaise = bill.totalPaise - paidPaise + bill.refundedPaise;
      const status = balancePaise <= 0 ? 'PAID' : 'PARTIAL';
      await tx.bill.update({ where: { id: b.billId }, data: { paidPaise, balancePaise, status } });
      await broadcastPayment(tx, clinicId, payment.id, 'billing.payment.succeeded');
      if (status === 'PAID' && bill.status !== 'PAID') await broadcastBill(tx, clinicId, b.billId, 'billing.bill.paid');
      return { paymentId: payment.id, replay: false };
    });
    if (!result.replay) {
      await fastify.audit('PAYMENT_ADJUSTMENT', 'Payment', result.paymentId, { billId: b.billId, amountPaise: b.amountPaise, reason: b.reason });
      reply.status(201);
    }
    return ok(await paymentDetail(clinicId, result.paymentId));
  });

  // ── Reads ──
  fastify.get('/payments', anyRole, async (req) => {
    const q = parse(ListPaymentsQuery, req.query);
    const clinicId = req.clinicId!;
    const where: Record<string, unknown> = { clinicId };
    if (q.billId) where.billId = q.billId;
    if (q.patientId) where.patientId = q.patientId;
    if (q.method) where.method = q.method;
    if (q.status) where.status = q.status;
    if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
    const rows = await prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    const items = rows.slice(0, q.limit).map((p) => toPaymentResponse(p));
    return ok({ items, nextCursor: hasMore ? items[items.length - 1]!.id : null });
  });

  fastify.get('/payments/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    return ok(await paymentDetail(req.clinicId!, id));
  });

  // Cancel a still-PENDING payment (e.g. an unpaid Razorpay link). Settled payments need a refund.
  fastify.post('/payments/:id/cancel', receptionistAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const payment = await prisma.payment.findFirst({ where: { id, clinicId } });
    if (!payment) throw new NotFoundError('Payment not found');
    if (payment.status !== 'PENDING') {
      throw new AppError('Only a PENDING payment can be cancelled', 422, 'PAYMENT_NOT_CANCELLABLE');
    }
    await prisma.payment.update({ where: { id }, data: { status: 'CANCELLED' } });
    await fastify.audit('PAYMENT_CANCELLED', 'Payment', id, {});
    return ok(await paymentDetail(clinicId, id));
  });
}
