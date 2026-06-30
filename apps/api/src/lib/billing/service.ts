import type { ServerEvent } from '@odovox/types';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { broadcastToClinic } from '../realtime/broadcast.js';
import { computeBillTotals } from './totals.js';
import { BILL_SUMMARY_INCLUDE, toBillSummary, toPaymentSummary, toRefundSummary } from './serialize.js';

/**
 * The interactive-transaction client type of the extended Prisma client (with the scope/audit
 * hooks). The full client is assignable to it too, so helpers typed `BillingTx` accept either
 * `prisma` or a `tx` from `prisma.$transaction`. Mirrors QueueTx in lib/queue/engine.ts.
 */
export type BillingTx = ExtendedPrismaClient extends {
  $transaction(fn: (tx: infer T) => Promise<unknown>): Promise<unknown>;
}
  ? T
  : never;

/**
 * Recompute and persist a Bill's money fields from its current items + bill-level discount + GST.
 * Server-side source of truth — call after any item or discount mutation, and at finalize. Leaves
 * `paidPaise`/`refundedPaise` untouched (the payment/refund routes own those) and re-derives
 * `balancePaise = total − paid + refunded`. Does NOT change `status` — route actions own transitions.
 */
export async function recomputeBillTotals(db: BillingTx, billId: string): Promise<void> {
  const bill = await db.bill.findUniqueOrThrow({ where: { id: billId }, include: { items: true } });
  const totals = computeBillTotals({
    items: bill.items,
    discountPaise: bill.discountPaise,
    gstApplicable: bill.gstApplicable,
    gstPercent: Number(bill.gstPercent),
  });
  const balancePaise = totals.totalPaise - bill.paidPaise + bill.refundedPaise;
  await db.bill.update({
    where: { id: billId },
    data: {
      subtotalPaise: totals.subtotalPaise,
      discountPaise: totals.discountPaise,
      gstPaise: totals.gstPaise,
      totalPaise: totals.totalPaise,
      balancePaise,
    },
  });
}

type BillEventType = 'billing.bill.created' | 'billing.bill.finalized' | 'billing.bill.paid';

/** Reload the bill summary and broadcast a billing.bill.* event to the clinic. */
export async function broadcastBill(
  db: BillingTx,
  clinicId: string,
  billId: string,
  type: BillEventType,
): Promise<void> {
  const row = await db.bill.findFirstOrThrow({ where: { id: billId, clinicId }, include: BILL_SUMMARY_INCLUDE });
  const event = { type, payload: toBillSummary(row) } as Extract<ServerEvent, { type: BillEventType }>;
  broadcastToClinic(clinicId, event);
}

type PaymentEventType = 'billing.payment.succeeded' | 'billing.payment.pending';

/** Broadcast a billing.payment.* event for a payment id. */
export async function broadcastPayment(
  db: BillingTx,
  clinicId: string,
  paymentId: string,
  type: PaymentEventType,
): Promise<void> {
  const row = await db.payment.findFirstOrThrow({ where: { id: paymentId, clinicId } });
  broadcastToClinic(clinicId, { type, payload: toPaymentSummary(row) });
}

/** Broadcast a billing.refund.created event for a refund id. */
export async function broadcastRefund(db: BillingTx, clinicId: string, refundId: string): Promise<void> {
  const row = await db.refund.findFirstOrThrow({ where: { id: refundId, clinicId } });
  broadcastToClinic(clinicId, { type: 'billing.refund.created', payload: toRefundSummary(row) });
}
