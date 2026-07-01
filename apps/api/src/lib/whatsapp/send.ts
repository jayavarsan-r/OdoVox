import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import type { IWhatsAppProvider } from './provider.js';
import { checkConsent } from './consent.js';
import { normalizeIndianPhone, renderTemplateBody, serializeMessage, startOfMonth, type MessageAttachmentShape } from './render.js';
import { broadcastToClinic } from '../realtime/broadcast.js';

interface Logger {
  info(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
}

export interface SendDeps {
  prisma: ExtendedPrismaClient;
  provider: IWhatsAppProvider;
  /** Hand the PENDING message id to the BullMQ send queue (injected — no-op in unit tests). */
  enqueue: (messageId: string) => Promise<void>;
  /** Semantic audit hook (fastify.audit); optional so the pipeline is unit-testable without Fastify. */
  audit?: (action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown>) => Promise<void>;
  logger?: Logger;
}

export interface SendWhatsAppInput {
  clinicId: string;
  patientId: string;
  templateKey: string;
  variables: Record<string, string>;
  attachments?: MessageAttachmentShape[];
  triggerType?: string;
  triggerEntityType?: string;
  triggerEntityId?: string;
  idempotencyKey?: string;
  /** Receptionist/doctor who triggered a manual send; null for system-triggered. */
  createdById?: string | null;
}

export type SendBlockReason =
  | 'NOT_ASKED'
  | 'PENDING'
  | 'OPTED_OUT'
  | 'EXPIRED'
  | 'BUDGET_EXCEEDED'
  | 'TEMPLATE_NOT_FOUND'
  | 'TEMPLATE_NOT_APPROVED'
  | 'TEMPLATE_DISABLED'
  | 'INVALID_PHONE';

export interface SendOutcome {
  messageId: string | null;
  status: string;
  queued: boolean;
  blocked: boolean;
  deduped: boolean;
  reason?: SendBlockReason;
}

/** Sum of spend (paise) this calendar month for a clinic — sends that actually left the building. */
export async function monthSpendPaise(prisma: ExtendedPrismaClient, clinicId: string): Promise<number> {
  const agg = await prisma.whatsAppMessage.aggregate({
    where: {
      clinicId,
      direction: 'OUTBOUND',
      status: { in: ['SENT', 'DELIVERED', 'READ'] },
      createdAt: { gte: startOfMonth() },
    },
    _sum: { costPaise: true },
  });
  return agg._sum.costPaise ?? 0;
}

/**
 * The one send pipeline every outbound WhatsApp message flows through — routes, cross-wires, and the
 * reminder cron all call this. Blocking checks (idempotency → consent → budget → template → phone)
 * run before any row is inserted; when a send is blocked it is still logged (BLOCKED_*), never
 * silently dropped. On success a PENDING row is inserted and the provider call is deferred to the
 * BullMQ send worker (`runWhatsAppSendJob`), so the caller returns immediately.
 */
export async function sendWhatsAppMessage(deps: SendDeps, input: SendWhatsAppInput): Promise<SendOutcome> {
  const { prisma } = deps;
  const { clinicId, patientId } = input;

  // 1. Idempotency — same key ⇒ return the existing message, never double-send.
  if (input.idempotencyKey) {
    const existing = await prisma.whatsAppMessage.findUnique({
      where: { clinicId_idempotencyKey: { clinicId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) {
      return { messageId: existing.id, status: existing.status, queued: false, blocked: existing.status.startsWith('BLOCKED'), deduped: true };
    }
  }

  // 2. Consent gate.
  const consent = await checkConsent(prisma, clinicId, patientId);
  if (!consent.canSend) {
    const msg = await insertBlocked(deps, input, 'BLOCKED_NO_CONSENT', consent.reason ?? 'NOT_ASKED');
    return { messageId: msg.id, status: 'BLOCKED_NO_CONSENT', queued: false, blocked: true, deduped: false, reason: consent.reason as SendBlockReason };
  }

  // 4. Template lookup (must be APPROVED + enabled).
  const template = await prisma.whatsAppTemplate.findUnique({
    where: { clinicId_templateKey: { clinicId, templateKey: input.templateKey } },
  });
  if (!template) {
    await deps.logger?.error?.({ clinicId, templateKey: input.templateKey }, 'whatsapp template not found');
    return { messageId: null, status: 'FAILED', queued: false, blocked: true, deduped: false, reason: 'TEMPLATE_NOT_FOUND' };
  }
  if (template.approvalStatus !== 'APPROVED') {
    return { messageId: null, status: 'FAILED', queued: false, blocked: true, deduped: false, reason: 'TEMPLATE_NOT_APPROVED' };
  }
  if (!template.isEnabled) {
    return { messageId: null, status: 'FAILED', queued: false, blocked: true, deduped: false, reason: 'TEMPLATE_DISABLED' };
  }

  // 3. Budget gate (after template so we know the estimated cost).
  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });
  if (clinic.whatsappBudgetPaise != null) {
    const spent = await monthSpendPaise(prisma, clinicId);
    if (spent + template.estimatedCostPaise > clinic.whatsappBudgetPaise) {
      const msg = await insertBlocked(deps, input, 'BLOCKED_BUDGET', 'BUDGET_EXCEEDED', template.id);
      return { messageId: msg.id, status: 'BLOCKED_BUDGET', queued: false, blocked: true, deduped: false, reason: 'BUDGET_EXCEEDED' };
    }
  }

  // 5. Phone validation (E.164 +91).
  const patient = await prisma.patient.findFirstOrThrow({ where: { id: patientId, clinicId } });
  const phone = normalizeIndianPhone(patient.phone);
  if (!phone) {
    return { messageId: null, status: 'FAILED', queued: false, blocked: true, deduped: false, reason: 'INVALID_PHONE' };
  }

  // 6. Render body.
  const body = renderTemplateBody(template.body, input.variables);

  // 7. Insert PENDING, 8. enqueue.
  const message = await prisma.whatsAppMessage.create({
    data: {
      clinicId,
      patientId,
      direction: 'OUTBOUND',
      templateId: template.id,
      templateVariables: input.variables,
      body,
      attachments: input.attachments ? (input.attachments as object) : undefined,
      status: 'PENDING',
      idempotencyKey: input.idempotencyKey ?? null,
      triggerType: input.triggerType ?? null,
      triggerEntityType: input.triggerEntityType ?? null,
      triggerEntityId: input.triggerEntityId ?? null,
      createdById: input.createdById ?? null,
    },
  });

  await deps.enqueue(message.id);
  return { messageId: message.id, status: 'PENDING', queued: true, blocked: false, deduped: false };
}

async function insertBlocked(
  deps: SendDeps,
  input: SendWhatsAppInput,
  status: 'BLOCKED_NO_CONSENT' | 'BLOCKED_BUDGET',
  reason: string,
  templateId?: string,
) {
  const template =
    templateId != null
      ? { id: templateId }
      : await deps.prisma.whatsAppTemplate.findUnique({
          where: { clinicId_templateKey: { clinicId: input.clinicId, templateKey: input.templateKey } },
          select: { id: true, body: true },
        });
  const body = template && 'body' in template && template.body ? renderTemplateBody(template.body, input.variables) : '';
  await deps.audit?.(
    status === 'BLOCKED_NO_CONSENT' ? 'WHATSAPP_CONSENT_VIOLATION_BLOCKED' : 'WHATSAPP_BUDGET_BLOCKED',
    'WhatsAppMessage',
    input.patientId,
    { templateKey: input.templateKey, reason, triggerType: input.triggerType },
  );
  return deps.prisma.whatsAppMessage.create({
    data: {
      clinicId: input.clinicId,
      patientId: input.patientId,
      direction: 'OUTBOUND',
      templateId: template?.id ?? null,
      templateVariables: input.variables,
      body,
      status,
      failureReason: reason,
      idempotencyKey: input.idempotencyKey ?? null,
      triggerType: input.triggerType ?? null,
      triggerEntityType: input.triggerEntityType ?? null,
      triggerEntityId: input.triggerEntityId ?? null,
      createdById: input.createdById ?? null,
    },
  });
}

// ---------------------------------------------------------------------------
// Worker body — the deferred provider call. Standalone + injected deps (mirrors runSttJob), so it
// runs identically in-process, in a future worker process, or called directly from a test.
// ---------------------------------------------------------------------------

export interface SendWorkerDeps {
  prisma: ExtendedPrismaClient;
  provider: IWhatsAppProvider;
  logger?: Logger;
}

export async function runWhatsAppSendJob(deps: SendWorkerDeps, messageId: string): Promise<void> {
  const { prisma, provider } = deps;
  const message = await prisma.whatsAppMessage.findUnique({ where: { id: messageId }, include: { template: true, patient: true } });
  if (!message || message.status !== 'PENDING') return;
  if (!message.patient || !message.template) return;

  const phone = normalizeIndianPhone(message.patient.phone);
  if (!phone) {
    await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: 'INVALID_PHONE' },
    });
    return;
  }

  const variables = (message.templateVariables as Record<string, string> | null) ?? {};
  const params = message.template.variables.map((_, i) => variables[String(i + 1)] ?? '');
  const attachments = (message.attachments as MessageAttachmentShape[] | null) ?? undefined;
  const media = attachments?.[0] ? { url: attachments[0].url, filename: attachments[0].name } : undefined;

  try {
    const result = await provider.sendTemplate({
      campaignName: message.template.templateName,
      destination: phone,
      userName: message.patient.name,
      templateParams: params,
      media,
    });
    const failed = result.status === 'failed';
    const updated = await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: {
        status: failed ? 'FAILED' : 'SENT',
        providerMessageId: result.providerMessageId,
        providerStatus: result.status,
        costPaise: result.costPaise,
        sentAt: failed ? null : new Date(),
        failedAt: failed ? new Date() : null,
        failureReason: failed ? 'PROVIDER_FAILED' : null,
      },
    });
    if (failed) throw new Error('provider reported failed status'); // let BullMQ retry
    broadcastToClinic(message.clinicId, {
      type: 'whatsapp.message.sent',
      payload: { patientId: message.patientId, message: serializeMessage(updated) },
    });
  } catch (err) {
    await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: { status: 'FAILED', failedAt: new Date(), failureReason: (err as Error).message.slice(0, 200) },
    });
    throw err; // surface to BullMQ for retry/backoff
  }
}
