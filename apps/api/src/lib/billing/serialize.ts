import type { Prisma } from '@odovox/db';
import type {
  BillItemResponse,
  BillResponse,
  BillSummary,
  PaymentResponse,
  PaymentSummary,
  RefundResponse,
  RefundSummary,
} from '@odovox/types';

// Prisma include shapes — keep the joins the serializers depend on in one place.
export const BILL_SUMMARY_INCLUDE = {
  patient: { select: { name: true } },
} satisfies Prisma.BillInclude;

export const BILL_DETAIL_INCLUDE = {
  patient: { select: { name: true } },
  items: { orderBy: { createdAt: 'asc' } },
  payments: { orderBy: { createdAt: 'asc' } },
  refunds: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.BillInclude;

type BillSummaryRow = Prisma.BillGetPayload<{ include: typeof BILL_SUMMARY_INCLUDE }>;
type BillDetailRow = Prisma.BillGetPayload<{ include: typeof BILL_DETAIL_INCLUDE }>;
type BillItemRow = Prisma.BillItemGetPayload<true>;
type PaymentRow = Prisma.PaymentGetPayload<true>;
type RefundRow = Prisma.RefundGetPayload<true>;

function billMoney(row: { gstPercent: Prisma.Decimal } & Record<string, unknown>) {
  return { gstPercent: Number(row.gstPercent) };
}

export function toBillItemResponse(row: BillItemRow): BillItemResponse {
  return {
    id: row.id,
    kind: row.kind,
    description: row.description,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    quantity: row.quantity,
    unitPricePaise: row.unitPricePaise,
    discountPaise: row.discountPaise,
    subtotalPaise: row.subtotalPaise,
    notes: row.notes,
    createdAt: row.createdAt,
  };
}

export function toPaymentResponse(row: PaymentRow & { razorpayShortUrl?: string | null }): PaymentResponse {
  return {
    id: row.id,
    paymentNumber: row.paymentNumber,
    billId: row.billId,
    patientId: row.patientId,
    amountPaise: row.amountPaise,
    method: row.method,
    status: row.status,
    upiId: row.upiId,
    upiTxnRef: row.upiTxnRef,
    cardLast4: row.cardLast4,
    cardNetwork: row.cardNetwork,
    bankTxnRef: row.bankTxnRef,
    razorpayLinkId: row.razorpayLinkId,
    razorpayPaymentId: row.razorpayPaymentId,
    razorpayShortUrl: row.razorpayShortUrl ?? null,
    razorpayFee: row.razorpayFee,
    refundedAmountPaise: row.refundedAmountPaise,
    receivedById: row.receivedById,
    receivedAt: row.receivedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toRefundResponse(row: RefundRow): RefundResponse {
  return {
    id: row.id,
    refundNumber: row.refundNumber,
    paymentId: row.paymentId,
    billId: row.billId,
    amountPaise: row.amountPaise,
    reason: row.reason,
    method: row.method,
    status: row.status,
    razorpayRefundId: row.razorpayRefundId,
    processedById: row.processedById,
    processedAt: row.processedAt,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function toBillSummary(row: BillSummaryRow): BillSummary {
  return {
    id: row.id,
    clinicId: row.clinicId,
    billNumber: row.billNumber,
    patientId: row.patientId,
    patientName: row.patientNameSnapshot || row.patient.name,
    visitId: row.visitId,
    status: row.status,
    subtotalPaise: row.subtotalPaise,
    discountPaise: row.discountPaise,
    discountReason: row.discountReason,
    gstApplicable: row.gstApplicable,
    ...billMoney(row),
    gstPaise: row.gstPaise,
    totalPaise: row.totalPaise,
    paidPaise: row.paidPaise,
    refundedPaise: row.refundedPaise,
    balancePaise: row.balancePaise,
    createdAt: row.createdAt,
    finalizedAt: row.finalizedAt,
  };
}

export function toBillResponse(row: BillDetailRow): BillResponse {
  return {
    ...toBillSummary(row),
    patientPhone: row.patientPhoneSnapshot,
    doctorIdSnapshot: row.doctorIdSnapshot,
    notes: row.notes,
    paidInFullAt: row.paidInFullAt,
    cancelledAt: row.cancelledAt,
    cancelledReason: row.cancelledReason,
    items: row.items.map(toBillItemResponse),
    payments: row.payments.map((p) => toPaymentResponse(p)),
    refunds: row.refunds.map(toRefundResponse),
    updatedAt: row.updatedAt,
  };
}

// Compact shapes for realtime broadcasts.
export function toBillSummaryEvent(row: BillSummaryRow): BillSummary {
  return toBillSummary(row);
}

export function toPaymentSummary(row: PaymentRow): PaymentSummary {
  return {
    id: row.id,
    clinicId: row.clinicId,
    paymentNumber: row.paymentNumber,
    billId: row.billId,
    patientId: row.patientId,
    amountPaise: row.amountPaise,
    method: row.method,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export function toRefundSummary(row: RefundRow): RefundSummary {
  return {
    id: row.id,
    clinicId: row.clinicId,
    refundNumber: row.refundNumber,
    billId: row.billId,
    paymentId: row.paymentId,
    amountPaise: row.amountPaise,
    method: row.method,
    status: row.status,
    createdAt: row.createdAt,
  };
}
