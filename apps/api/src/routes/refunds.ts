import type { FastifyInstance } from 'fastify';
import { CreateRefundInput, ListRefundsQuery } from '@odovox/types';
import { ok, parse } from '../lib/http.js';
import { requireRole, requireAdmin } from '../lib/rbac.js';
import { NotFoundError } from '../lib/errors.js';
import { recordRefund } from '../lib/billing/refund-service.js';
import { toRefundResponse } from '../lib/billing/serialize.js';

export async function refundRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const adminOnly = { preHandler: [fastify.authenticate, requireAdmin()] };

  async function refundDetail(clinicId: string, id: string) {
    const row = await prisma.refund.findFirst({ where: { id, clinicId } });
    if (!row) throw new NotFoundError('Refund not found');
    return toRefundResponse(row);
  }

  // Refunds are admin-only (see the Phase 8 RBAC matrix).
  fastify.post('/refunds', adminOnly, async (req, reply) => {
    const b = parse(CreateRefundInput, req.body);
    const clinicId = req.clinicId!;
    const refundId = await recordRefund(
      prisma,
      { clinicId, paymentId: b.paymentId, amountPaise: b.amountPaise, reason: b.reason, method: b.method, userId: req.user!.id },
      req.log,
    );
    await fastify.audit('REFUND_CREATED', 'Refund', refundId, { paymentId: b.paymentId, amountPaise: b.amountPaise });
    reply.status(201);
    return ok(await refundDetail(clinicId, refundId));
  });

  fastify.get('/refunds', anyRole, async (req) => {
    const q = parse(ListRefundsQuery, req.query);
    const clinicId = req.clinicId!;
    const where: Record<string, unknown> = { clinicId };
    if (q.billId) where.billId = q.billId;
    if (q.paymentId) where.paymentId = q.paymentId;
    if (q.from || q.to) where.createdAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
    const rows = await prisma.refund.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    const items = rows.slice(0, q.limit).map(toRefundResponse);
    return ok({ items, nextCursor: hasMore ? items[items.length - 1]!.id : null });
  });

  fastify.get('/refunds/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    return ok(await refundDetail(req.clinicId!, id));
  });
}
