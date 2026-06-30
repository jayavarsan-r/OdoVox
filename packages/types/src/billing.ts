import { z } from 'zod';
import {
  BillStatus,
  ItemKind,
  PaiseAmount,
  PaymentMethod,
  PaymentStatus,
  RefundStatus,
  Timestamps,
} from './common.js';

// ---------------------------------------------------------------------------
// Bill items
// ---------------------------------------------------------------------------

export const BillItemSource = z.enum(['procedure', 'lab_case', 'inventory', 'manual']);
export type BillItemSource = z.infer<typeof BillItemSource>;

export const BillItemInput = z.object({
  kind: ItemKind,
  description: z.string().min(1).max(200),
  sourceType: BillItemSource.optional(),
  sourceId: z.string().min(1).optional(),
  quantity: z.number().int().positive().default(1),
  unitPricePaise: PaiseAmount,
  discountPaise: PaiseAmount.default(0),
  notes: z.string().max(500).optional(),
});
export type BillItemInput = z.infer<typeof BillItemInput>;

export const UpdateBillItemInput = BillItemInput.partial();
export type UpdateBillItemInput = z.infer<typeof UpdateBillItemInput>;

export const BillItemResponse = z.object({
  id: z.string(),
  kind: ItemKind,
  description: z.string(),
  sourceType: z.string().nullable(),
  sourceId: z.string().nullable(),
  quantity: z.number().int(),
  unitPricePaise: PaiseAmount,
  discountPaise: PaiseAmount,
  subtotalPaise: PaiseAmount,
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
});
export type BillItemResponse = z.infer<typeof BillItemResponse>;

// ---------------------------------------------------------------------------
// Bill CRUD inputs
// ---------------------------------------------------------------------------

export const CreateBillInput = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  items: z.array(BillItemInput).optional(),
  notes: z.string().max(1000).optional(),
});
export type CreateBillInput = z.infer<typeof CreateBillInput>;

export const UpdateBillInput = z.object({
  notes: z.string().max(1000).nullable().optional(),
  discountPaise: PaiseAmount.optional(),
  discountReason: z.string().max(200).nullable().optional(),
});
export type UpdateBillInput = z.infer<typeof UpdateBillInput>;

export const CancelBillInput = z.object({ reason: z.string().min(1).max(300) });
export type CancelBillInput = z.infer<typeof CancelBillInput>;

export const ReopenBillInput = z.object({ reason: z.string().max(300).optional() });
export type ReopenBillInput = z.infer<typeof ReopenBillInput>;

export const ListBillsQuery = z.object({
  status: BillStatus.optional(),
  patientId: z.string().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  search: z.string().max(120).optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListBillsQuery = z.infer<typeof ListBillsQuery>;

// ---------------------------------------------------------------------------
// Payment inputs (one endpoint per method; all carry an idempotency key)
// ---------------------------------------------------------------------------

const PaymentBase = {
  billId: z.string().min(1),
  amountPaise: PaiseAmount,
  idempotencyKey: z.string().min(8).max(64),
  receivedAt: z.coerce.date().optional(),
};

export const CashPaymentInput = z.object({ ...PaymentBase });
export type CashPaymentInput = z.infer<typeof CashPaymentInput>;

export const UpiManualPaymentInput = z.object({
  ...PaymentBase,
  upiId: z.string().max(120).optional(),
  upiTxnRef: z.string().min(1).max(120),
});
export type UpiManualPaymentInput = z.infer<typeof UpiManualPaymentInput>;

export const CardManualPaymentInput = z.object({
  ...PaymentBase,
  cardLast4: z.string().regex(/^\d{4}$/).optional(),
  cardNetwork: z.string().max(40).optional(),
});
export type CardManualPaymentInput = z.infer<typeof CardManualPaymentInput>;

export const BankTransferPaymentInput = z.object({
  ...PaymentBase,
  bankTxnRef: z.string().min(1).max(120),
});
export type BankTransferPaymentInput = z.infer<typeof BankTransferPaymentInput>;

export const AdjustmentInput = z.object({
  billId: z.string().min(1),
  // Positive adjusts the balance down (credit); negative adjusts it up.
  amountPaise: z.number().int().refine((n) => n !== 0, 'Adjustment cannot be zero'),
  reason: z.string().min(1).max(300),
  idempotencyKey: z.string().min(8).max(64),
});
export type AdjustmentInput = z.infer<typeof AdjustmentInput>;

export const RazorpayLinkInput = z.object({
  billId: z.string().min(1),
  amountPaise: PaiseAmount,
  notify: z.enum(['sms', 'whatsapp', 'both', 'none']).default('whatsapp'),
  expiresInHours: z.number().int().min(1).max(720).optional(),
  idempotencyKey: z.string().min(8).max(64),
});
export type RazorpayLinkInput = z.infer<typeof RazorpayLinkInput>;

export const ListPaymentsQuery = z.object({
  billId: z.string().min(1).optional(),
  patientId: z.string().min(1).optional(),
  method: PaymentMethod.optional(),
  status: PaymentStatus.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListPaymentsQuery = z.infer<typeof ListPaymentsQuery>;

// ---------------------------------------------------------------------------
// Payment + refund responses (created via the /payments + /refunds routes)
// ---------------------------------------------------------------------------

export const PaymentResponse = z
  .object({
    id: z.string(),
    paymentNumber: z.string(),
    billId: z.string(),
    patientId: z.string(),
    amountPaise: PaiseAmount,
    method: PaymentMethod,
    status: PaymentStatus,
    upiId: z.string().nullable(),
    upiTxnRef: z.string().nullable(),
    cardLast4: z.string().nullable(),
    cardNetwork: z.string().nullable(),
    bankTxnRef: z.string().nullable(),
    razorpayLinkId: z.string().nullable(),
    razorpayPaymentId: z.string().nullable(),
    razorpayShortUrl: z.string().nullable().optional(),
    razorpayFee: PaiseAmount,
    refundedAmountPaise: PaiseAmount,
    receivedById: z.string(),
    receivedAt: z.coerce.date().nullable(),
    notes: z.string().nullable(),
  })
  .merge(Timestamps);
export type PaymentResponse = z.infer<typeof PaymentResponse>;

export const RefundResponse = z
  .object({
    id: z.string(),
    refundNumber: z.string(),
    paymentId: z.string(),
    billId: z.string(),
    amountPaise: PaiseAmount,
    reason: z.string(),
    method: PaymentMethod,
    status: RefundStatus,
    razorpayRefundId: z.string().nullable(),
    processedById: z.string(),
    processedAt: z.coerce.date().nullable(),
    notes: z.string().nullable(),
  })
  .merge(Timestamps);
export type RefundResponse = z.infer<typeof RefundResponse>;

// ---------------------------------------------------------------------------
// Bill responses
// ---------------------------------------------------------------------------

const BillMoney = {
  subtotalPaise: PaiseAmount,
  discountPaise: PaiseAmount,
  discountReason: z.string().nullable(),
  gstApplicable: z.boolean(),
  gstPercent: z.number(),
  gstPaise: PaiseAmount,
  totalPaise: PaiseAmount,
  paidPaise: PaiseAmount,
  refundedPaise: PaiseAmount,
  balancePaise: PaiseAmount,
};

/** Compact bill shape for lists + realtime broadcasts. */
export const BillSummaryZ = z.object({
  id: z.string(),
  clinicId: z.string(),
  billNumber: z.string(),
  patientId: z.string(),
  patientName: z.string(),
  visitId: z.string().nullable(),
  status: BillStatus,
  ...BillMoney,
  createdAt: z.coerce.date(),
  finalizedAt: z.coerce.date().nullable(),
});
export type BillSummary = z.infer<typeof BillSummaryZ>;

export const BillResponse = BillSummaryZ.extend({
  patientPhone: z.string(),
  doctorIdSnapshot: z.string().nullable(),
  notes: z.string().nullable(),
  paidInFullAt: z.coerce.date().nullable(),
  cancelledAt: z.coerce.date().nullable(),
  cancelledReason: z.string().nullable(),
  items: z.array(BillItemResponse),
  payments: z.array(PaymentResponse),
  refunds: z.array(RefundResponse),
  updatedAt: z.coerce.date(),
});
export type BillResponse = z.infer<typeof BillResponse>;

// Compact payment/refund shapes for realtime broadcasts.
export const PaymentSummaryZ = z.object({
  id: z.string(),
  clinicId: z.string(),
  paymentNumber: z.string(),
  billId: z.string(),
  patientId: z.string(),
  amountPaise: PaiseAmount,
  method: PaymentMethod,
  status: PaymentStatus,
  createdAt: z.coerce.date(),
});
export type PaymentSummary = z.infer<typeof PaymentSummaryZ>;

export const RefundSummaryZ = z.object({
  id: z.string(),
  clinicId: z.string(),
  refundNumber: z.string(),
  billId: z.string(),
  paymentId: z.string(),
  amountPaise: PaiseAmount,
  method: PaymentMethod,
  status: RefundStatus,
  createdAt: z.coerce.date(),
});
export type RefundSummary = z.infer<typeof RefundSummaryZ>;
