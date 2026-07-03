import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { LabCaseStatus } from '@odovox/types';
import { NotFoundError, UnprocessableError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole } from '../lib/rbac.js';
import { transitionLabCase, undoLlmTransition } from '../lib/lab/transition-service.js';
import { OPEN_LAB_STATUSES } from '../lib/lab/transitions.js';
import { getLabTransport } from '../lib/lab-transport/adapters.js';
import { storage } from '../lib/storage.js';

const ListQuery = z.object({
  filter: z.enum(['all', 'needs_action', 'with_case', 'unlinked']).default('all'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const ResolveInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('link'), caseId: z.string().min(1), newStatus: LabCaseStatus.optional() }),
  z.object({ action: z.literal('apply_suggestion') }),
  z.object({ action: z.literal('handled') }),
]);

const ReplyInput = z.object({ text: z.string().min(1).max(2000) });

/**
 * Phase 9.7 §2.12 — the reception lab inbox (tier 4). Everything the parser couldn't resolve
 * lands here; one tap resolves it, and every resolution is logged as a labeled example
 * (LabParseTrainingExample) to improve tiers 2–3 over time.
 */
export async function labInboxRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };

  fastify.get('/lab/messages', anyRole, async (req) => {
    const q = parse(ListQuery, req.query);
    const clinicId = req.clinicId!;
    const where: Record<string, unknown> = { clinicId, direction: 'INBOUND' };
    if (q.filter === 'needs_action') where.resolved = false;
    if (q.filter === 'with_case') where.labCaseId = { not: null };
    if (q.filter === 'unlinked') where.labCaseId = null;

    const rows = await prisma.labMessage.findMany({
      where,
      include: {
        vendor: { select: { id: true, name: true } },
        labCase: { select: { id: true, caseCode: true, type: true, teeth: true, status: true, patient: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
    });
    const items = await Promise.all(
      rows.map(async (m) => ({
        id: m.id,
        vendorId: m.labVendorId,
        vendorName: m.vendor?.name ?? m.fromPhone ?? 'Unknown sender',
        body: m.body,
        parseTier: m.parseTier,
        parseConfidence: m.parseConfidence ? Number(m.parseConfidence) : null,
        resolved: m.resolved,
        llmSuggestion: m.llmSuggestion,
        labCase: m.labCase
          ? { id: m.labCase.id, caseCode: m.labCase.caseCode, type: m.labCase.type, teeth: m.labCase.teeth, status: m.labCase.status, patientName: m.labCase.patient.name }
          : null,
        mediaUrls: await Promise.all(m.mediaPaths.map((k) => storage.getSignedUrl(k, 300).catch(() => null))),
        createdAt: m.createdAt,
      })),
    );
    return ok({ items });
  });

  /** Full thread with one lab — chronological, case-code chips render client-side. */
  fastify.get('/lab/messages/thread/:vendorId', anyRole, async (req) => {
    const { vendorId } = req.params as { vendorId: string };
    const rows = await prisma.labMessage.findMany({
      where: { clinicId: req.clinicId!, labVendorId: vendorId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return ok({
      items: rows.map((m) => ({
        id: m.id,
        direction: m.direction,
        body: m.body,
        templateKey: m.templateKey,
        parseTier: m.parseTier,
        createdAt: m.createdAt,
      })),
    });
  });

  /** Open cases with this lab — the "Link to case" dropdown. */
  fastify.get('/lab/messages/:id/candidates', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const message = await prisma.labMessage.findFirst({ where: { id, clinicId: req.clinicId! } });
    if (!message) throw new NotFoundError('Message not found');
    const cases = await prisma.labCase.findMany({
      where: { clinicId: req.clinicId!, ...(message.labVendorId ? { vendorId: message.labVendorId } : {}), status: { in: OPEN_LAB_STATUSES } },
      include: { patient: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return ok({
      items: cases.map((c) => ({ id: c.id, caseCode: c.caseCode, type: c.type, teeth: c.teeth, status: c.status, patientName: c.patient.name })),
    });
  });

  fastify.post('/lab/messages/:id/resolve', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(ResolveInput, req.body);
    const clinicId = req.clinicId!;
    const message = await prisma.labMessage.findFirst({ where: { id, clinicId } });
    if (!message) throw new NotFoundError('Message not found');

    let resolvedCaseId: string | null = message.labCaseId;
    let resolvedStatus: string | null = null;

    if (body.action === 'link') {
      resolvedCaseId = body.caseId;
      if (body.newStatus) {
        // A human read the message — reception_manual, with the lab's words on the timeline.
        await transitionLabCase(prisma, {
          clinicId,
          caseId: body.caseId,
          to: body.newStatus,
          trigger: 'reception_manual',
          note: message.body?.slice(0, 300) ?? null,
          byUserId: req.user!.id,
          sourceLabMessageId: message.id,
        });
        resolvedStatus = body.newStatus;
      }
    } else if (body.action === 'apply_suggestion') {
      const suggestion = message.llmSuggestion as { caseId?: string | null; newStatus?: string | null } | null;
      if (!suggestion?.caseId || !suggestion.newStatus) {
        throw new UnprocessableError('This message has no applicable AI suggestion', 'NO_SUGGESTION');
      }
      await transitionLabCase(prisma, {
        clinicId,
        caseId: suggestion.caseId,
        to: suggestion.newStatus as LabCaseStatus,
        trigger: 'reception_manual', // human approved the below-gate suggestion
        note: message.body?.slice(0, 300) ?? null,
        byUserId: req.user!.id,
        sourceLabMessageId: message.id,
      });
      resolvedCaseId = suggestion.caseId;
      resolvedStatus = suggestion.newStatus;
    }

    await prisma.labMessage.update({
      where: { id },
      data: { resolved: true, labCaseId: resolvedCaseId, parseTier: message.parseTier ?? 'manual', llmSuggestion: undefined },
    });
    // §2.9 tier 4 — every human resolution becomes a labeled example.
    await prisma.labParseTrainingExample.create({
      data: { clinicId, labMessageId: id, body: message.body, resolvedCaseId, resolvedStatus, action: body.action },
    });
    await fastify.audit('LAB_MESSAGE_RESOLVED', 'LabMessage', id, { action: body.action, caseId: resolvedCaseId });
    return ok({ resolved: true, caseId: resolvedCaseId, status: resolvedStatus });
  });

  /** Free-text reply within the 24h service window. */
  fastify.post('/lab/messages/:id/reply', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(ReplyInput, req.body);
    const clinicId = req.clinicId!;
    const message = await prisma.labMessage.findFirst({ where: { id, clinicId }, include: { vendor: true } });
    if (!message?.vendor) throw new NotFoundError('Message or lab not found');
    const destination = message.fromPhone ?? message.vendor.whatsappPhoneNumbers[0];
    if (!destination) throw new UnprocessableError('No WhatsApp number for this lab', 'LAB_SEND_NO_WHATSAPP_NUMBER');

    const result = await getLabTransport().sendMessage({ destination, vendorName: message.vendor.name, text: body.text });
    const sent = await prisma.labMessage.create({
      data: {
        clinicId,
        labVendorId: message.vendor.id,
        labCaseId: message.labCaseId,
        direction: 'OUTBOUND',
        waMessageId: `${result.providerMessageId}#${Date.now().toString(36)}`,
        body: body.text,
        costPaise: result.costPaise,
        resolved: true,
      },
    });
    await fastify.audit('LAB_MESSAGE_REPLIED', 'LabMessage', sent.id, { toVendorId: message.vendor.id });
    return ok({ id: sent.id });
  });

  /** One-tap undo of an AI-parsed transition (§2.13, 24h window). */
  fastify.post('/lab/events/:id/undo', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const { labCase } = await undoLlmTransition(prisma, { clinicId: req.clinicId!, eventId: id, byUserId: req.user!.id });
    await fastify.audit('LAB_LLM_TRANSITION_UNDONE', 'LabCaseEvent', id, {});
    return ok({ caseId: labCase.id, status: labCase.status });
  });

  /** §2.14 — per-lab performance (sales-asset data). */
  fastify.get('/lab/vendors/:id/analytics', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const vendor = await prisma.labVendor.findFirst({ where: { id, clinicId } });
    if (!vendor) throw new NotFoundError('Lab vendor not found');
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const last30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const cases = await prisma.labCase.findMany({
      where: { clinicId, vendorId: id, createdAt: { gte: since } },
      select: { id: true, status: true, sentAt: true, returnedAt: true, expectedReturnAt: true, createdAt: true },
    });
    const withTurnaround = cases.filter((c) => c.sentAt && c.returnedAt);
    const turnaroundDays = withTurnaround.length
      ? withTurnaround.reduce((sum, c) => sum + (c.returnedAt!.getTime() - c.sentAt!.getTime()), 0) / withTurnaround.length / 86_400_000
      : null;
    const withExpectation = cases.filter((c) => c.returnedAt && c.expectedReturnAt);
    const onTimeRate = withExpectation.length
      ? withExpectation.filter((c) => c.returnedAt!.getTime() <= c.expectedReturnAt!.getTime()).length / withExpectation.length
      : null;
    const overdueOpen = cases.filter(
      (c) => OPEN_LAB_STATUSES.includes(c.status) && c.expectedReturnAt && c.expectedReturnAt.getTime() < Date.now(),
    ).length;
    const issues = await prisma.labCaseEvent.count({
      where: { clinicId, toStatus: 'ISSUE_RAISED', createdAt: { gte: since }, labCase: { vendorId: id } },
    });

    // Median first-reply latency: first INBOUND after the first OUTBOUND per case.
    const outbound = await prisma.labMessage.findMany({
      where: { clinicId, labVendorId: id, direction: 'OUTBOUND', labCaseId: { not: null }, createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { labCaseId: true, createdAt: true },
    });
    const inboundMsgs = await prisma.labMessage.findMany({
      where: { clinicId, labVendorId: id, direction: 'INBOUND', createdAt: { gte: since } },
      orderBy: { createdAt: 'asc' },
      select: { labCaseId: true, createdAt: true },
    });
    const firstOut = new Map<string, number>();
    for (const m of outbound) if (!firstOut.has(m.labCaseId!)) firstOut.set(m.labCaseId!, m.createdAt.getTime());
    const latencies: number[] = [];
    for (const [caseId, at] of firstOut) {
      const reply = inboundMsgs.find((m) => m.labCaseId === caseId && m.createdAt.getTime() > at);
      if (reply) latencies.push(reply.createdAt.getTime() - at);
    }
    latencies.sort((a, b) => a - b);
    const medianReplyHours = latencies.length ? latencies[Math.floor(latencies.length / 2)]! / 3_600_000 : null;

    const costAgg = await prisma.labMessage.aggregate({
      where: { clinicId, labVendorId: id, direction: 'OUTBOUND', createdAt: { gte: last30 } },
      _sum: { costPaise: true },
    });
    const volume30 = cases.filter((c) => c.createdAt >= last30).length;

    return ok({
      windowDays: 90,
      turnaroundDaysAvg: turnaroundDays !== null ? Math.round(turnaroundDays * 10) / 10 : null,
      targetTurnaroundDays: vendor.defaultTurnaroundDays,
      onTimeRate: onTimeRate !== null ? Math.round(onTimeRate * 100) / 100 : null,
      overdueOpenCount: overdueOpen,
      volume90: cases.length,
      volume30,
      issuesRaised: issues,
      issueRate: cases.length ? Math.round((issues / cases.length) * 100) / 100 : null,
      medianReplyHours: medianReplyHours !== null ? Math.round(medianReplyHours * 10) / 10 : null,
      // §2.17 — per-case message cost; alert territory above ₹2 (bug: too many nudges).
      monthCostPaise: costAgg._sum.costPaise ?? 0,
      costPerCasePaise: volume30 ? Math.round((costAgg._sum.costPaise ?? 0) / volume30) : 0,
    });
  });
}
