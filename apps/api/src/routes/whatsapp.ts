import type { FastifyInstance } from 'fastify';
import { SendMessageInput, BulkReminderInput, ConversationListFilter, ReplyInput } from '@odovox/types';
import { AppError, NotFoundError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole, requireAdmin } from '../lib/rbac.js';
import { sendWhatsAppMessage } from '../lib/whatsapp/send.js';
import { whatsappSendDeps } from '../lib/whatsapp/deps.js';
import { getWhatsAppProvider } from '../lib/whatsapp/index.js';
import { serializeMessage, normalizeIndianPhone } from '../lib/whatsapp/render.js';
import { serializeConversationListItem, touchConversationOnOutbound, windowOpen } from '../lib/whatsapp/conversation.js';
import { broadcastToClinic } from '../lib/realtime/broadcast.js';

export async function whatsappRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const adminOnly = { preHandler: [fastify.authenticate, requireAdmin()] };

  // POST /whatsapp/send — receptionist free-form template send.
  fastify.post('/whatsapp/send', anyRole, async (req) => {
    const body = parse(SendMessageInput, req.body);
    const clinicId = req.clinicId!;
    const outcome = await sendWhatsAppMessage(whatsappSendDeps(fastify), {
      clinicId,
      patientId: body.patientId,
      templateKey: body.templateKey,
      variables: body.variables,
      attachments: body.attachments,
      triggerType: 'MANUAL',
      createdById: req.user!.id,
    });
    if (outcome.blocked && !outcome.messageId) {
      throw new AppError(`Send blocked: ${outcome.reason}`, 422, 'WHATSAPP_SEND_BLOCKED');
    }
    return ok(outcome);
  });

  // POST /whatsapp/bulk-reminder — admin: nudge every patient with an outstanding balance.
  fastify.post('/whatsapp/bulk-reminder', adminOnly, async (req) => {
    const body = parse(BulkReminderInput, req.body);
    const clinicId = req.clinicId!;
    const minBalance = body.filter.minBalancePaise ?? 1;
    const patients = await prisma.patient.findMany({
      where: { clinicId, deletedAt: null, outstandingPaise: { gte: minBalance } },
      select: { id: true, name: true, outstandingPaise: true },
    });
    const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });

    const deps = whatsappSendDeps(fastify);
    let queued = 0;
    let blocked = 0;
    for (const p of patients) {
      const outcome = await sendWhatsAppMessage(deps, {
        clinicId,
        patientId: p.id,
        templateKey: body.templateKey,
        variables: { 1: p.name, 2: (p.outstandingPaise / 100).toFixed(2), 3: clinic.name },
        triggerType: 'BULK_REMINDER',
        idempotencyKey: `bulk:${body.templateKey}:${p.id}:${new Date().toISOString().slice(0, 10)}`,
        createdById: req.user!.id,
      });
      if (outcome.queued) queued++;
      else blocked++;
    }
    await fastify.audit('WHATSAPP_BULK_REMINDER', 'Clinic', clinicId, { templateKey: body.templateKey, queued, blocked });
    return ok({ total: patients.length, queued, blocked });
  });

  // ===========================================================================
  // Conversations (receptionist inbox)
  // ===========================================================================

  // GET /whatsapp/conversations — inbox list, filterable by status/category, most-recent first.
  fastify.get('/whatsapp/conversations', anyRole, async (req) => {
    const q = parse(ConversationListFilter, req.query);
    const clinicId = req.clinicId!;
    const where: Record<string, unknown> = { clinicId };
    if (q.status !== 'ALL') where.status = q.status;
    if (q.category) where.category = q.category;
    const rows = await prisma.patientConversation.findMany({
      where,
      include: { patient: { select: { name: true } } },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
    return ok(rows.map(serializeConversationListItem));
  });

  async function loadConvoOr404(clinicId: string, id: string) {
    const convo = await prisma.patientConversation.findFirst({ where: { id, clinicId }, include: { patient: { select: { name: true } } } });
    if (!convo) throw new NotFoundError('Conversation not found');
    return convo;
  }

  // GET /whatsapp/conversations/:id — detail + messages; opening it clears the unread count.
  fastify.get('/whatsapp/conversations/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const convo = await loadConvoOr404(clinicId, id);
    if (convo.unreadCount > 0) {
      await prisma.patientConversation.update({ where: { id }, data: { unreadCount: 0 } });
    }
    const messages = await prisma.whatsAppMessage.findMany({
      where: { clinicId, conversationId: id },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    return ok({
      ...serializeConversationListItem({ ...convo, unreadCount: 0 }),
      assignedToUserId: convo.assignedToUserId,
      windowOpen: windowOpen(convo),
      messages: messages.map(serializeMessage),
    });
  });

  // POST /whatsapp/conversations/:id/reply — free-text reply, only within the 24-hour window.
  fastify.post('/whatsapp/conversations/:id/reply', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const body = parse(ReplyInput, req.body);
    const convo = await loadConvoOr404(clinicId, id);
    if (!windowOpen(convo)) {
      throw new AppError('The 24-hour reply window has closed — send an approved template instead', 422, 'WHATSAPP_WINDOW_CLOSED');
    }
    const patient = await prisma.patient.findFirstOrThrow({ where: { id: convo.patientId, clinicId } });
    const phone = normalizeIndianPhone(patient.phone);
    if (!phone) throw new AppError('Patient phone is not a valid +91 number', 422, 'INVALID_PHONE');

    const result = await getWhatsAppProvider(fastify.log).sendSession({ destination: phone, userName: patient.name, text: body.text });
    const message = await prisma.whatsAppMessage.create({
      data: {
        clinicId,
        patientId: convo.patientId,
        direction: 'OUTBOUND',
        body: body.text,
        status: result.status === 'failed' ? 'FAILED' : 'SENT',
        providerMessageId: result.providerMessageId,
        providerStatus: result.status,
        costPaise: result.costPaise,
        conversationId: id,
        triggerType: 'MANUAL_REPLY',
        sentAt: new Date(),
        createdById: req.user!.id,
      },
    });
    await touchConversationOnOutbound(prisma, id, body.text, new Date());
    await fastify.audit('WHATSAPP_REPLY_SENT', 'PatientConversation', id, {});
    broadcastToClinic(clinicId, { type: 'whatsapp.message.sent', payload: { patientId: convo.patientId, message: serializeMessage(message) } });
    return ok(serializeMessage(message));
  });

  // POST /whatsapp/conversations/:id/resolve — close the conversation.
  fastify.post('/whatsapp/conversations/:id/resolve', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    await loadConvoOr404(clinicId, id);
    const updated = await prisma.patientConversation.update({
      where: { id },
      data: { status: 'RESOLVED', resolvedAt: new Date(), resolvedByUserId: req.user!.id, unreadCount: 0 },
      include: { patient: { select: { name: true } } },
    });
    await fastify.audit('WHATSAPP_CONVERSATION_RESOLVED', 'PatientConversation', id, {});
    broadcastToClinic(clinicId, { type: 'whatsapp.conversation.updated', payload: serializeConversationListItem(updated) });
    return ok(serializeConversationListItem(updated));
  });

  // GET /patients/:id/whatsapp/messages — recent WhatsApp activity for the patient-detail card.
  fastify.get('/patients/:id/whatsapp/messages', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const clinicId = req.clinicId!;
    const messages = await prisma.whatsAppMessage.findMany({
      where: { clinicId, patientId: id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return ok(messages.map(serializeMessage));
  });
}
