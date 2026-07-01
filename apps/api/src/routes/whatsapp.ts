import type { FastifyInstance } from 'fastify';
import { SendMessageInput, BulkReminderInput } from '@odovox/types';
import { AppError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireRole, requireAdmin } from '../lib/rbac.js';
import { sendWhatsAppMessage } from '../lib/whatsapp/send.js';
import { whatsappSendDeps } from '../lib/whatsapp/deps.js';

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
}
