import type { FastifyInstance } from 'fastify';
import { sendWhatsAppMessage } from './send.js';
import { whatsappSendDeps } from './deps.js';
import type { MessageAttachmentShape } from './render.js';

/**
 * Best-effort patient notifications fired from other phases' route handlers, always AFTER the
 * owning transaction commits. Every call is consent-gated inside the send pipeline and wrapped so a
 * WhatsApp hiccup can never fail the lab/payment operation that triggered it. Idempotency keys make
 * a retried request safe.
 */

const CASE_TYPE_LABEL: Record<string, string> = {
  CROWN: 'crown',
  BRIDGE: 'bridge',
  DENTURE_FULL: 'full denture',
  DENTURE_PARTIAL: 'partial denture',
  ALIGNER: 'aligner',
  NIGHT_GUARD: 'night guard',
  OCCLUSAL_SPLINT: 'occlusal splint',
  VENEER: 'veneer',
  INLAY_ONLAY: 'inlay/onlay',
  RPD: 'removable partial denture',
  OTHER: 'lab case',
};

/** Phase 7 → Phase 9: lab case reached READY. Tell the patient it's ready for fitting. */
export async function notifyLabCaseReady(fastify: FastifyInstance, clinicId: string, caseId: string): Promise<void> {
  try {
    const c = await fastify.prisma.labCase.findFirst({
      where: { id: caseId, clinicId },
      include: { patient: { select: { name: true } } },
    });
    if (!c) return;
    const clinic = await fastify.prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { name: true } });
    await sendWhatsAppMessage(whatsappSendDeps(fastify), {
      clinicId,
      patientId: c.patientId,
      templateKey: 'lab_case_ready',
      variables: { 1: c.patient.name, 2: CASE_TYPE_LABEL[c.type] ?? 'lab case', 3: clinic.name },
      triggerType: 'LAB_CASE_READY',
      triggerEntityType: 'LabCase',
      triggerEntityId: caseId,
      idempotencyKey: `lab_ready:${caseId}`,
    });
  } catch (err) {
    fastify.log.error({ err, caseId }, 'lab_case_ready WhatsApp send failed (non-fatal)');
  }
}

/** Phase 8 → Phase 9: a payment succeeded. Send the receipt (with the receipt PDF, when provided). */
export async function notifyPaymentReceipt(
  fastify: FastifyInstance,
  args: { clinicId: string; patientId: string; paymentId: string; amountPaise: number; receiptNumber: string; attachment?: MessageAttachmentShape },
): Promise<void> {
  try {
    const patient = await fastify.prisma.patient.findFirst({
      where: { id: args.patientId, clinicId: args.clinicId },
      select: { name: true },
    });
    if (!patient) return;
    await sendWhatsAppMessage(whatsappSendDeps(fastify), {
      clinicId: args.clinicId,
      patientId: args.patientId,
      templateKey: 'payment_receipt',
      variables: { 1: patient.name, 2: (args.amountPaise / 100).toFixed(2), 3: args.receiptNumber },
      attachments: args.attachment ? [args.attachment] : undefined,
      triggerType: 'PAYMENT_RECEIPT',
      triggerEntityType: 'Payment',
      triggerEntityId: args.paymentId,
      idempotencyKey: `receipt:${args.paymentId}`,
    });
  } catch (err) {
    fastify.log.error({ err, paymentId: args.paymentId }, 'payment_receipt WhatsApp send failed (non-fatal)');
  }
}
