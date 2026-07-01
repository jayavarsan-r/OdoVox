import type { PatientConversation } from '@odovox/db';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';

const WINDOW_MS = 24 * 60 * 60 * 1000;

/** Heuristic auto-categorisation of an inbound message body → a conversation category. */
export function categorize(text: string): 'RESCHEDULE_REQUEST' | 'COMPLAINT' | 'PRESCRIPTION_QUESTION' | 'PAYMENT_QUERY' | 'GENERAL_QUERY' {
  const t = text.toLowerCase();
  if (/(reschedul|cancel|postpone|change.*(appointment|time)|different (day|time))/.test(t)) return 'RESCHEDULE_REQUEST';
  if (/(pain|swollen|swelling|bleed|complain|hurt|infection|emergency)/.test(t)) return 'COMPLAINT';
  if (/(medicine|prescription|tablet|dosage|medication|drug)/.test(t)) return 'PRESCRIPTION_QUESTION';
  if (/(bill|payment|invoice|receipt|pay|balance|refund|charge)/.test(t)) return 'PAYMENT_QUERY';
  return 'GENERAL_QUERY';
}

/** Is the 24-hour customer-service window still open for a conversation? */
export function windowOpen(convo: { windowExpiresAt: Date | null }, now = new Date()): boolean {
  return convo.windowExpiresAt != null && convo.windowExpiresAt.getTime() > now.getTime();
}

export interface UpsertConversationInput {
  clinicId: string;
  patientId: string;
  inboundText: string;
  inboundAt: Date;
  category?: PatientConversation['category'];
}

/**
 * Find-or-create the patient's conversation and fold in a new inbound message: refresh the 24-hour
 * window, bump the unread count, update the preview, and (re)categorise. First message opens the
 * conversation; a later one moves it to IN_PROGRESS (unless already RESOLVED, which reopens it).
 */
export async function upsertConversationOnInbound(
  prisma: ExtendedPrismaClient,
  input: UpsertConversationInput,
): Promise<PatientConversation> {
  const existing = await prisma.patientConversation.findUnique({
    where: { clinicId_patientId: { clinicId: input.clinicId, patientId: input.patientId } },
  });
  const category = input.category ?? categorize(input.inboundText);
  const windowExpiresAt = new Date(input.inboundAt.getTime() + WINDOW_MS);
  const preview = input.inboundText.slice(0, 140);

  if (!existing) {
    return prisma.patientConversation.create({
      data: {
        clinicId: input.clinicId,
        patientId: input.patientId,
        status: 'OPEN',
        category,
        lastInboundAt: input.inboundAt,
        windowExpiresAt,
        lastMessageAt: input.inboundAt,
        lastMessagePreview: preview,
        unreadCount: 1,
      },
    });
  }

  return prisma.patientConversation.update({
    where: { id: existing.id },
    data: {
      status: existing.status === 'RESOLVED' ? 'OPEN' : 'IN_PROGRESS',
      category,
      lastInboundAt: input.inboundAt,
      windowExpiresAt,
      lastMessageAt: input.inboundAt,
      lastMessagePreview: preview,
      unreadCount: { increment: 1 },
      resolvedAt: existing.status === 'RESOLVED' ? null : existing.resolvedAt,
    },
  });
}

/** Bump a conversation's preview/last-message when the clinic sends an outbound reply (no unread). */
export async function touchConversationOnOutbound(
  prisma: ExtendedPrismaClient,
  conversationId: string,
  preview: string,
  at: Date,
): Promise<void> {
  await prisma.patientConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: at, lastMessagePreview: preview.slice(0, 140) },
  });
}

export function serializeConversationListItem(c: PatientConversation & { patient?: { name: string } }) {
  return {
    id: c.id,
    patientId: c.patientId,
    patientName: c.patient?.name ?? '',
    status: c.status,
    category: c.category ?? null,
    lastMessageAt: c.lastMessageAt ?? null,
    lastMessagePreview: c.lastMessagePreview ?? null,
    unreadCount: c.unreadCount,
    windowExpiresAt: c.windowExpiresAt ?? null,
  };
}
