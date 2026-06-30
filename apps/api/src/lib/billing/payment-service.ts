import type { PaymentMethod } from '@odovox/db';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { AppError, NotFoundError } from '../errors.js';
import { buildPaymentNumber, generateUniqueNumber } from './numbers.js';
import { broadcastBill, broadcastPayment } from './service.js';

export interface RecordPaymentInput {
  clinicId: string;
  billId: string;
  userId: string;
  amountPaise: number;
  method: PaymentMethod;
  idempotencyKey: string;
  receivedAt?: Date | null;
  upiId?: string | null;
  upiTxnRef?: string | null;
  cardLast4?: string | null;
  cardNetwork?: string | null;
  bankTxnRef?: string | null;
  notes?: string | null;
}

export interface RecordPaymentResult {
  paymentId: string;
  /** True when an existing payment with the same idempotency key was returned (no new charge). */
  idempotentReplay: boolean;
  newlyPaid: boolean;
}

/**
 * Record a manual payment (Cash/UPI/Card/Bank) against a FINALIZED or PARTIAL bill, in one
 * transaction: idempotency check → insert Payment(SUCCEEDED) → recompute bill paid/balance/status →
 * broadcast. Idempotent on (clinicId, idempotencyKey): a retry with the same key returns the
 * existing payment instead of double-charging. All money in paise. See docs/billing.md.
 */
export async function recordManualPayment(
  prisma: ExtendedPrismaClient,
  input: RecordPaymentInput,
): Promise<RecordPaymentResult> {
  const { clinicId, billId, amountPaise } = input;

  return prisma.$transaction(async (tx) => {
    // Idempotency — same key returns the prior payment, no new row, no bill change.
    const prior = await tx.payment.findFirst({ where: { clinicId, idempotencyKey: input.idempotencyKey } });
    if (prior) return { paymentId: prior.id, idempotentReplay: true, newlyPaid: false };

    const bill = await tx.bill.findFirst({ where: { id: billId, clinicId, deletedAt: null } });
    if (!bill) throw new NotFoundError('Bill not found');
    if (bill.status !== 'FINALIZED' && bill.status !== 'PARTIAL') {
      throw new AppError('Bill must be finalized before recording a payment', 422, 'BILL_NOT_PAYABLE');
    }
    if (amountPaise <= 0) throw new AppError('Amount must be positive', 422, 'PAYMENT_AMOUNT_INVALID');
    if (amountPaise > bill.balancePaise) {
      throw new AppError('Payment exceeds the outstanding balance', 422, 'PAYMENT_EXCEEDS_BALANCE');
    }

    const clinic = await tx.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { joinCode: true } });
    const paymentNumber = await generateUniqueNumber(
      buildPaymentNumber,
      async (c) => !!(await tx.payment.findFirst({ where: { clinicId, paymentNumber: c }, select: { id: true } })),
      clinic.joinCode,
      'payment number',
    );

    const payment = await tx.payment.create({
      data: {
        clinicId,
        billId,
        patientId: bill.patientId,
        paymentNumber,
        amountPaise,
        method: input.method,
        status: 'SUCCEEDED',
        idempotencyKey: input.idempotencyKey,
        receivedById: input.userId,
        receivedAt: input.receivedAt ?? new Date(),
        upiId: input.upiId ?? null,
        upiTxnRef: input.upiTxnRef ?? null,
        cardLast4: input.cardLast4 ?? null,
        cardNetwork: input.cardNetwork ?? null,
        bankTxnRef: input.bankTxnRef ?? null,
        notes: input.notes ?? null,
      },
    });

    const paidPaise = bill.paidPaise + amountPaise;
    const balancePaise = bill.totalPaise - paidPaise + bill.refundedPaise;
    const status = balancePaise <= 0 ? 'PAID' : 'PARTIAL';
    // bill.status is FINALIZED or PARTIAL here (guarded above), so reaching PAID is always "newly".
    const newlyPaid = status === 'PAID';
    await tx.bill.update({
      where: { id: billId },
      data: { paidPaise, balancePaise, status, paidInFullAt: newlyPaid ? new Date() : bill.paidInFullAt },
    });

    await broadcastPayment(tx, clinicId, payment.id, 'billing.payment.succeeded');
    if (newlyPaid) await broadcastBill(tx, clinicId, billId, 'billing.bill.paid');

    return { paymentId: payment.id, idempotentReplay: false, newlyPaid };
  });
}
