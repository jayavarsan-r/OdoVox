import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { runAsSystem } from '../../lib/request-context.js';
import { broadcastToClinic } from '../realtime/broadcast.js';
import { processLabInbound } from '../lab-transport/inbound-service.js';
import type { InboundEvent, StatusEvent } from './provider.js';
import { normalizeIndianPhone, serializeMessage } from './render.js';
import { serializeConversationListItem, upsertConversationOnInbound } from './conversation.js';

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored' | 'failed';

/** Dedup a webhook via the shared WebhookEvent table (first writer wins). Returns false if duplicate. */
async function recordEvent(
  prisma: ExtendedPrismaClient,
  source: string,
  eventId: string,
  eventType: string,
  payload: unknown,
  signature: string,
): Promise<boolean> {
  try {
    await prisma.webhookEvent.create({
      data: { source, eventId, eventType, payload: (payload ?? {}) as object, signature, status: 'received' },
    });
    return true;
  } catch {
    return false;
  }
}

/** Resolve which clinic + patient an inbound message belongs to (clinic by business number, patient by phone). */
async function resolve(prisma: ExtendedPrismaClient, event: InboundEvent): Promise<{ clinicId: string; patientId: string | null } | null> {
  const fromTen = normalizeIndianPhone(event.fromPhone)?.slice(3) ?? event.fromPhone.replace(/\D/g, '').slice(-10);

  // Prefer the clinic that owns the business number the patient messaged.
  let clinicId: string | null = null;
  if (event.toPhone) {
    const norm = normalizeIndianPhone(event.toPhone) ?? event.toPhone;
    const clinic = await prisma.clinic.findFirst({
      where: { OR: [{ whatsappAccountPhoneNumber: norm }, { whatsappAccountPhoneNumber: event.toPhone }] },
      select: { id: true },
    });
    clinicId = clinic?.id ?? null;
  }

  // Match the patient by phone (within the resolved clinic, or across clinics as a fallback).
  const patient = await prisma.patient.findFirst({
    where: { phone: fromTen, deletedAt: null, ...(clinicId ? { clinicId } : {}) },
    select: { id: true, clinicId: true },
  });
  if (patient) return { clinicId: patient.clinicId, patientId: patient.id };
  if (clinicId) return { clinicId, patientId: null }; // known clinic, unknown patient → admin review row
  return null;
}

/** Button "1" on an appointment reminder → auto-confirm the most recent upcoming SCHEDULED appointment. */
async function handleButtonReply(prisma: ExtendedPrismaClient, clinicId: string, patientId: string, buttonId: string): Promise<'CONFIRMED' | 'RESCHEDULE' | null> {
  if (buttonId === '1') {
    const appt = await prisma.appointment.findFirst({
      where: { clinicId, patientId, status: 'SCHEDULED', deletedAt: null, startsAt: { gte: new Date() } },
      orderBy: { startsAt: 'asc' },
    });
    if (appt) {
      await prisma.appointment.update({ where: { id: appt.id }, data: { notes: appendNote(appt.notes, 'Confirmed by patient via WhatsApp') } });
      await prisma.auditLog.create({
        data: { clinicId, action: 'APPOINTMENT_CONFIRMED_VIA_WHATSAPP', entityType: 'Appointment', entityId: appt.id, metadata: {} },
      });
    }
    return 'CONFIRMED';
  }
  if (buttonId === '2') return 'RESCHEDULE';
  return null;
}

function appendNote(existing: string | null, note: string): string {
  return existing ? `${existing}\n${note}` : note;
}

export interface InboundWebhookArgs {
  eventId: string;
  events: InboundEvent[];
  payload: unknown;
  signature: string;
}

/**
 * Process an inbound WhatsApp webhook: dedup, then for each parsed message resolve the patient,
 * log an INBOUND WhatsAppMessage, fold it into the patient's conversation (auto-categorised, 24h
 * window refreshed, unread bumped), handle quick-reply buttons (confirm/reschedule) and broadcast.
 */
export async function processInboundWebhook(prisma: ExtendedPrismaClient, args: InboundWebhookArgs): Promise<{ outcome: WebhookOutcome; created: number }> {
  const first = await recordEvent(prisma, 'whatsapp_inbound', args.eventId, 'inbound', args.payload, args.signature);
  if (!first) return { outcome: 'duplicate', created: 0 };

  return runAsSystem(async () => {
    let created = 0;
    for (const event of args.events) {
      // Phase 9.7 §2.8 — route by sender FIRST: a lab's WhatsApp number is more specific than a
      // patient phone (a technician could also be a patient). Lab traffic never touches patient
      // conversations.
      const senderE164 = normalizeIndianPhone(event.fromPhone) ?? event.fromPhone;
      const labVendor = await prisma.labVendor.findFirst({
        where: { isArchived: false, whatsappPhoneNumbers: { has: senderE164 } },
      });
      if (labVendor) {
        await processLabInbound(prisma, { vendor: labVendor, event });
        created++;
        continue;
      }

      const resolved = await resolve(prisma, event);
      if (!resolved) continue; // can't attribute to any clinic → drop (logged upstream)
      const { clinicId, patientId } = resolved;
      const at = event.timestamp ?? new Date();
      const text = event.text ?? (event.type === 'button_reply' ? (event.buttonId ?? '') : '');

      // Unknown patient → row for admin review, no conversation.
      if (!patientId) {
        await prisma.whatsAppMessage.create({
          data: {
            clinicId,
            direction: 'INBOUND',
            body: text,
            status: 'RECEIVED',
            inboundFromPhone: event.fromPhone,
            inboundType: event.type,
            inboundButtonId: event.buttonId ?? null,
            providerMessageId: event.providerMessageId ?? null,
            createdAt: at,
          },
        });
        created++;
        continue;
      }

      // Button quick-reply side effects (confirm appointment / flag reschedule).
      let category: 'RESCHEDULE_REQUEST' | undefined;
      if (event.type === 'button_reply' && event.buttonId) {
        const action = await handleButtonReply(prisma, clinicId, patientId, event.buttonId);
        if (action === 'RESCHEDULE') category = 'RESCHEDULE_REQUEST';
      }

      const convo = await upsertConversationOnInbound(prisma, {
        clinicId,
        patientId,
        inboundText: text || (event.buttonId === '1' ? 'Confirmed' : 'Reschedule requested'),
        inboundAt: at,
        category,
      });

      const message = await prisma.whatsAppMessage.create({
        data: {
          clinicId,
          patientId,
          direction: 'INBOUND',
          body: text,
          status: 'RECEIVED',
          inboundFromPhone: event.fromPhone,
          inboundType: event.type,
          inboundButtonId: event.buttonId ?? null,
          providerMessageId: event.providerMessageId ?? null,
          conversationId: convo.id,
          createdAt: at,
        },
      });
      created++;

      broadcastToClinic(clinicId, {
        type: 'whatsapp.message.received',
        payload: { conversationId: convo.id, patientId, message: serializeMessage(message) },
      });
      const withPatient = await prisma.patientConversation.findUniqueOrThrow({ where: { id: convo.id }, include: { patient: { select: { name: true } } } });
      broadcastToClinic(clinicId, { type: 'whatsapp.conversation.updated', payload: serializeConversationListItem(withPatient) });
    }
    return { outcome: created > 0 ? 'processed' : 'ignored', created };
  });
}

export interface StatusWebhookArgs {
  eventId: string;
  events: StatusEvent[];
  payload: unknown;
  signature: string;
}

const STATUS_MAP = {
  sent: { status: 'SENT', field: 'sentAt' },
  delivered: { status: 'DELIVERED', field: 'deliveredAt' },
  read: { status: 'READ', field: 'readAt' },
  failed: { status: 'FAILED', field: 'failedAt' },
} as const satisfies Record<StatusEvent['status'], { status: string; field: 'sentAt' | 'deliveredAt' | 'readAt' | 'failedAt' }>;

/**
 * Process a delivery-status webhook: dedup, then advance each message's status + timestamp
 * (sent → delivered → read, or failed) and broadcast whatsapp.message.status_updated.
 */
export async function processStatusWebhook(prisma: ExtendedPrismaClient, args: StatusWebhookArgs): Promise<{ outcome: WebhookOutcome; updated: number }> {
  const first = await recordEvent(prisma, 'whatsapp_status', args.eventId, 'status', args.payload, args.signature);
  if (!first) return { outcome: 'duplicate', updated: 0 };

  return runAsSystem(async () => {
    let updated = 0;
    for (const event of args.events) {
      const message = await prisma.whatsAppMessage.findFirst({ where: { providerMessageId: event.providerMessageId } });
      if (!message) continue;
      const map = STATUS_MAP[event.status];
      const at = event.timestamp ?? new Date();
      await prisma.whatsAppMessage.update({
        where: { id: message.id },
        data: {
          status: map.status,
          providerStatus: event.status,
          [map.field]: at,
          failureReason: event.status === 'failed' ? (event.failureReason ?? 'PROVIDER_FAILED') : message.failureReason,
        },
      });
      updated++;
      broadcastToClinic(message.clinicId, {
        type: 'whatsapp.message.status_updated',
        payload: { messageId: message.id, status: map.status, conversationId: message.conversationId },
      });
    }
    return { outcome: updated > 0 ? 'processed' : 'ignored', updated };
  });
}
