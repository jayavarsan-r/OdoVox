'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../api-client';
import type {
  BillItemInput,
  BillResponse,
  BillSummary,
  CreateBillInput,
  CreateRefundInput,
  DailyCollectionResponse,
  OutstandingReportResponse,
  PaymentResponse,
  UpdateBillInput,
} from '@odovox/types';

interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/** A fresh idempotency key per payment attempt (nanoid(16)-equivalent). */
export function newIdempotencyKey(): string {
  return (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).replace(/-/g, '').slice(0, 24);
}

// ---- Bills ------------------------------------------------------------------
export function useBills(filters: { status?: string; patientId?: string } = {}) {
  const qs = new URLSearchParams();
  if (filters.status) qs.set('status', filters.status);
  if (filters.patientId) qs.set('patientId', filters.patientId);
  return useQuery({
    queryKey: ['bills', filters],
    queryFn: () => api.get<Paginated<BillSummary>>(`/bills?${qs.toString()}`),
  });
}

export function useBill(id: string | null) {
  return useQuery({
    queryKey: ['bill', id],
    queryFn: () => api.get<BillResponse>(`/bills/${id}`),
    enabled: !!id,
  });
}

/**
 * Ensure + fetch the visit's checkout bill. Idempotent POST: first open creates the DRAFT bill
 * auto-populated from the visit's procedures + lab charges; later opens return the same bill.
 * This is what puts the doctor's dictated cost in front of the receptionist (Phase 9.5 P1.5).
 */
export function useVisitBill(visitId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['visit-bill', visitId],
    queryFn: () => api.post<BillResponse>(`/visits/${visitId}/bill`),
    enabled: !!visitId && enabled,
  });
}

export function useCreateBill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBillInput) => api.post<BillResponse>('/bills', input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bills'] }),
  });
}

/** Bundled bill mutations keyed by bill id — used by the checkout sheet + bill detail. */
export function useBillActions(billId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bill', billId] });
    qc.invalidateQueries({ queryKey: ['bills'] });
  };
  const m = <T,>(fn: () => Promise<T>) => ({ mutationFn: fn, onSuccess: invalidate });
  return {
    patch: useMutation({ mutationFn: (b: UpdateBillInput) => api.patch<BillResponse>(`/bills/${billId}`, b), onSuccess: invalidate }),
    addItem: useMutation({ mutationFn: (i: BillItemInput) => api.post<BillResponse>(`/bills/${billId}/items`, i), onSuccess: invalidate }),
    removeItem: useMutation({ mutationFn: (itemId: string) => api.delete<BillResponse>(`/bills/${billId}/items/${itemId}`), onSuccess: invalidate }),
    finalize: useMutation(m(() => api.post<BillResponse>(`/bills/${billId}/finalize`))),
    cancel: useMutation({ mutationFn: (reason: string) => api.post<BillResponse>(`/bills/${billId}/cancel`, { reason }), onSuccess: invalidate }),
  };
}

// ---- Payments ---------------------------------------------------------------
export interface ManualPaymentArgs {
  billId: string;
  amountPaise: number;
  upiId?: string;
  upiTxnRef?: string;
  cardLast4?: string;
  cardNetwork?: string;
  bankTxnRef?: string;
}

export function usePayments(billId: string, qc = useQueryClient()) {
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bill', billId] });
    qc.invalidateQueries({ queryKey: ['bills'] });
    qc.invalidateQueries({ queryKey: ['daily-collection'] });
  };
  return {
    cash: useMutation({
      mutationFn: (a: ManualPaymentArgs) => api.post<PaymentResponse>('/payments/cash', { billId: a.billId, amountPaise: a.amountPaise, idempotencyKey: newIdempotencyKey() }),
      onSuccess: invalidate,
    }),
    upi: useMutation({
      mutationFn: (a: ManualPaymentArgs) => api.post<PaymentResponse>('/payments/upi-manual', { billId: a.billId, amountPaise: a.amountPaise, upiId: a.upiId, upiTxnRef: a.upiTxnRef ?? '', idempotencyKey: newIdempotencyKey() }),
      onSuccess: invalidate,
    }),
    card: useMutation({
      mutationFn: (a: ManualPaymentArgs) => api.post<PaymentResponse>('/payments/card-manual', { billId: a.billId, amountPaise: a.amountPaise, cardLast4: a.cardLast4, cardNetwork: a.cardNetwork, idempotencyKey: newIdempotencyKey() }),
      onSuccess: invalidate,
    }),
    razorpayLink: useMutation({
      mutationFn: (a: { billId: string; amountPaise: number; notify: 'sms' | 'whatsapp' | 'both' | 'none'; expiresInHours?: number }) =>
        api.post<PaymentResponse & { shortUrl: string; paymentId: string }>('/payments/razorpay/link', { ...a, idempotencyKey: newIdempotencyKey() }),
      onSuccess: invalidate,
    }),
  };
}

export function useRefund() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRefundInput) => api.post('/refunds', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bill'] });
      qc.invalidateQueries({ queryKey: ['bills'] });
    },
  });
}

// ---- Reports ----------------------------------------------------------------
export function useDailyCollection(date?: string) {
  return useQuery({
    queryKey: ['daily-collection', date ?? 'today'],
    queryFn: () => api.get<DailyCollectionResponse>(`/reports/daily-collection${date ? `?date=${date}` : ''}`),
  });
}

export function useOutstanding(doctorId?: string) {
  return useQuery({
    queryKey: ['outstanding', doctorId ?? 'all'],
    queryFn: () => api.get<OutstandingReportResponse>(`/reports/outstanding${doctorId ? `?doctorId=${doctorId}` : ''}`),
  });
}
