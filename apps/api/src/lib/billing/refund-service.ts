import type { PaymentMethod } from '@odovox/db';
import type { ExtendedPrismaClient } from '../../plugins/prisma.js';
import { AppError, NotFoundError } from '../errors.js';
import { getPaymentGateway, type PaymentLogger } from '../payments/index.js';
import { buildRefundNumber, generateUniqueNumber } from './numbers.js';
import { broadcastRefund } from './service.js';

export interface RecordRefundInput {
  clinicId: string;
  paymentId: string;
  amountPaise: number;
  reason: string;
  method?: PaymentMethod;
  userId: string;
}

/**
 * Record a refund against a SUCCEEDED payment, in one transaction: validate the refundable
 * remainder, (for Razorpay) call the gateway refund API, insert a Refund, bump the payment's
 * refundedAmount + status (REFUNDED/PARTIAL_REFUND), and add the amount back to the bill's balance.
 * Razorpay refunds start PENDING (the refund webhook confirms); cash/manual settle SUCCEEDED at once.
 * All money in paise. See docs/billing.md.
 */
export async function recordRefund(
  prisma: ExtendedPrismaClient,
  input: RecordRefundInput,
  logger?: PaymentLogger,
): Promise<string> {
  const { clinicId, paymentId, amountPaise } = input;
  const payment = await prisma.payment.findFirst({ where: { id: paymentId, clinicId } });
  if (!payment) throw new NotFoundError('Payment not found');
  if (payment.status !== 'SUCCEEDED' && payment.status !== 'PARTIAL_REFUND') {
    throw new AppError('Only a succeeded payment can be refunded', 422, 'PAYMENT_NOT_REFUNDABLE');
  }
  const refundable = payment.amountPaise - payment.refundedAmountPaise;
  if (amountPaise <= 0 || amountPaise > refundable) {
    throw new AppError('Refund exceeds the refundable amount on this payment', 422, 'REFUND_EXCEEDS_PAYMENT');
  }
  const method = input.method ?? payment.method;

  // For Razorpay, hit the gateway first so we never record a refund the gateway rejected.
  let razorpayRefundId: string | null = null;
  let razorpayStatus: string | null = null;
  if (method === 'RAZORPAY' && payment.razorpayPaymentId) {
    const res = await getPaymentGateway(logger).refund(payment.razorpayPaymentId, amountPaise, {
      reason: input.reason,
    });
    razorpayRefundId = res.refundId;
    razorpayStatus = res.status;
  }
  const refundStatus = method === 'RAZORPAY' ? 'PENDING' : 'SUCCEEDED';

  return prisma.$transaction(async (tx) => {
    const clinic = await tx.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { joinCode: true } });
    const refundNumber = await generateUniqueNumber(
      buildRefundNumber,
      async (c) => !!(await tx.refund.findFirst({ where: { clinicId, refundNumber: c }, select: { id: true } })),
      clinic.joinCode,
      'refund number',
    );
    const refund = await tx.refund.create({
      data: {
        clinicId,
        paymentId,
        billId: payment.billId,
        refundNumber,
        amountPaise,
        reason: input.reason,
        method,
        status: refundStatus,
        razorpayRefundId,
        razorpayStatus,
        processedById: input.userId,
        processedAt: refundStatus === 'SUCCEEDED' ? new Date() : null,
      },
    });

    const newRefundedOnPayment = payment.refundedAmountPaise + amountPaise;
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        refundedAmountPaise: newRefundedOnPayment,
        status: newRefundedOnPayment >= payment.amountPaise ? 'REFUNDED' : 'PARTIAL_REFUND',
      },
    });

    // Refunds add back to the bill's balance and re-open its status.
    const bill = await tx.bill.findUniqueOrThrow({ where: { id: payment.billId } });
    const refundedPaise = bill.refundedPaise + amountPaise;
    const balancePaise = bill.totalPaise - bill.paidPaise + refundedPaise;
    const netPaid = bill.paidPaise - refundedPaise;
    const status = netPaid <= 0 && refundedPaise > 0 ? 'REFUNDED' : balancePaise <= 0 ? 'PAID' : 'PARTIAL';
    await tx.bill.update({ where: { id: bill.id }, data: { refundedPaise, balancePaise, status } });

    await broadcastRefund(tx, clinicId, refund.id);
    return refund.id;
  });
}
