import { z } from 'zod';
import { BillStatus, PaiseAmount, PaymentMethod, Timestamps } from './common.js';

export const BillItem = z.object({
  desc: z.string().min(1),
  amount: PaiseAmount,
});
export type BillItem = z.infer<typeof BillItem>;

export const CreateBillInput = z.object({
  patientId: z.string().min(1),
  visitId: z.string().min(1).optional(),
  items: z.array(BillItem).min(1),
});
export type CreateBillInput = z.infer<typeof CreateBillInput>;

export const BillResponse = z
  .object({
    id: z.string(),
    patientId: z.string(),
    visitId: z.string().nullable(),
    items: z.array(BillItem),
    totalPaise: PaiseAmount,
    paidPaise: PaiseAmount,
    status: BillStatus,
  })
  .merge(Timestamps);
export type BillResponse = z.infer<typeof BillResponse>;

export const CreatePaymentInput = z.object({
  billId: z.string().min(1),
  amountPaise: PaiseAmount,
  method: PaymentMethod,
  reference: z.string().max(160).optional(),
});
export type CreatePaymentInput = z.infer<typeof CreatePaymentInput>;

export const PaymentResponse = z
  .object({
    id: z.string(),
    billId: z.string(),
    amountPaise: PaiseAmount,
    method: PaymentMethod,
    reference: z.string().nullable(),
    receivedById: z.string(),
    receivedAt: z.coerce.date(),
  })
  .merge(Timestamps);
export type PaymentResponse = z.infer<typeof PaymentResponse>;
