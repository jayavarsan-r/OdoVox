import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { broadcastBill, broadcastPayment } from './service.js';

export interface RazorpayWebhookArgs {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  signature: string;
  signatureValid: boolean;
}

export type WebhookOutcome = 'processed' | 'duplicate' | 'ignored' | 'failed';

interface RzpEntity {
  id?: string;
  fee?: number;
}
function entity(payload: Record<string, unknown>, key: 'payment' | 'payment_link'): RzpEntity {
  const node = payload[key] as { entity?: RzpEntity } | undefined;
  return node?.entity ?? {};
}

const SUCCESS_EVENTS = new Set(['payment_link.paid', 'payment.captured']);
const FAILURE_EVENTS = new Set(['payment.failed', 'payment_link.cancelled', 'payment_link.expired']);

/**
 * Process an inbound Razorpay webhook. Idempotent in two layers: (1) the (source, eventId) unique
 * index on WebhookEvent makes a replayed event a no-op; (2) we only credit a Payment that is still
 * PENDING, so even a fresh event id for an already-settled payment can't double-credit. The caller
 * must have already verified the HMAC signature (we record the result for audit). All money in paise.
 */
export async function processRazorpayWebhook(
  prisma: ExtendedPrismaClient,
  args: RazorpayWebhookArgs,
): Promise<{ outcome: WebhookOutcome; paymentId?: string }> {
  // Dedup: first writer wins; a duplicate event id throws on the unique index → no-op.
  try {
    await prisma.webhookEvent.create({
      data: {
        source: 'razorpay',
        eventId: args.eventId,
        eventType: args.eventType,
        payload: args.payload as object,
        signature: args.signature,
        status: 'received',
      },
    });
  } catch {
    return { outcome: 'duplicate' };
  }

  const markEvent = (status: string, clinicId: string | null, errorDetail?: string) =>
    prisma.webhookEvent.update({
      where: { source_eventId: { source: 'razorpay', eventId: args.eventId } },
      data: { status, clinicId, processedAt: new Date(), errorDetail: errorDetail ?? null },
    });

  const pay = entity(args.payload, 'payment');
  const link = entity(args.payload, 'payment_link');
  const orClauses = [
    ...(link.id ? [{ razorpayLinkId: link.id }] : []),
    ...(pay.id ? [{ razorpayPaymentId: pay.id }] : []),
  ];
  const payment = orClauses.length
    ? await prisma.payment.findFirst({ where: { method: 'RAZORPAY', OR: orClauses } })
    : null;

  if (!payment) {
    await markEvent('failed', null, 'No matching payment');
    return { outcome: 'failed' };
  }

  if (SUCCESS_EVENTS.has(args.eventType)) {
    if (payment.status !== 'PENDING') {
      await markEvent('processed', payment.clinicId); // already settled → no double-credit
      return { outcome: 'ignored', paymentId: payment.id };
    }
    await prisma.$transaction(async (tx) => {
      const bill = await tx.bill.findUniqueOrThrow({ where: { id: payment.billId } });
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'SUCCEEDED',
          razorpayPaymentId: pay.id ?? payment.razorpayPaymentId,
          razorpayFee: pay.fee ?? 0,
          receivedAt: new Date(),
        },
      });
      const paidPaise = bill.paidPaise + payment.amountPaise;
      const balancePaise = bill.totalPaise - paidPaise + bill.refundedPaise;
      const status = balancePaise <= 0 ? 'PAID' : 'PARTIAL';
      const newlyPaid = status === 'PAID' && bill.status !== 'PAID';
      await tx.bill.update({
        where: { id: bill.id },
        data: { paidPaise, balancePaise, status, paidInFullAt: newlyPaid ? new Date() : bill.paidInFullAt },
      });
      await broadcastPayment(tx, payment.clinicId, payment.id, 'billing.payment.succeeded');
      if (newlyPaid) await broadcastBill(tx, payment.clinicId, bill.id, 'billing.bill.paid');
    });
    await markEvent('processed', payment.clinicId);
    return { outcome: 'processed', paymentId: payment.id };
  }

  if (FAILURE_EVENTS.has(args.eventType)) {
    if (payment.status === 'PENDING') {
      await prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    }
    await markEvent('processed', payment.clinicId);
    return { outcome: 'processed', paymentId: payment.id };
  }

  await markEvent('processed', payment.clinicId);
  return { outcome: 'ignored', paymentId: payment.id };
}
