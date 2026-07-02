'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { BillItemsExtraction, PaymentMethod } from '@odovox/types';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { VoiceInput } from '@/components/voice/voice-input';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';
import { api, ApiError } from '@/lib/api-client';
import { useBill, useBillActions, usePayments, useRefund } from '@/lib/billing/api';
import { CHECKOUT_METHODS, billStatusStyle, canAddPayment, canRefund, checkoutStep, methodLabel, rupees, waMeLink } from '@/lib/billing/format';
import { cn } from '@/lib/utils';

/**
 * Bill detail + actions sheet. Drives the itemized checkout: finalize a DRAFT, record a payment
 * (Cash/UPI/Card or a Razorpay link), and — for admins — refund a payment. §12.1: glass only on
 * modals, so this sheet uses the BottomSheet (modal) surface; the body stays solid paper.
 */
export function BillSheet({ billId, onClose }: { billId: string | null; onClose: () => void }) {
  const isAdmin = !!useAuth((s) => s.activeMembership)?.isAdmin;
  const toast = useToast();
  const qc = useQueryClient();
  const { data: bill, isLoading } = useBill(billId);

  // Phase 9.7 W1.2.6 — dictate line items onto a DRAFT bill: extraction → apply through the
  // existing DRAFT-gated item endpoint (totals recompute there), then refetch.
  async function onItemsDictated({ extraction }: { extraction: BillItemsExtraction; transcript: string }) {
    if (!bill) return;
    if (extraction.clarifications.length) toast.info(extraction.clarifications.join(' '));
    if (!extraction.items.length) return;
    try {
      for (const item of extraction.items) {
        await api.post(`/bills/${bill.id}/items`, {
          kind: 'PROCEDURE',
          description: item.description,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
        });
      }
      if (extraction.discountPaise) {
        await api.patch(`/bills/${bill.id}`, {
          discountPaise: extraction.discountPaise,
          ...(extraction.discountReason ? { discountReason: extraction.discountReason } : {}),
        });
      }
      toast.success(`Added ${extraction.items.length} item${extraction.items.length > 1 ? 's' : ''} — review before finalizing.`);
      void qc.invalidateQueries({ queryKey: ['bill', bill.id] });
      void qc.invalidateQueries({ queryKey: ['bills'] });
    } catch (e) {
      toast.apiError(e);
    }
  }
  const actions = useBillActions(billId ?? '');
  const pay = usePayments(billId ?? '');
  const refund = useRefund();
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [amount, setAmount] = useState('');
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  const onError = (e: unknown) => toast.error(e instanceof ApiError ? e.message : 'Something went wrong');
  const amountPaise = Math.round(Number(amount) * 100);

  async function record() {
    if (!bill) return;
    try {
      if (method === 'RAZORPAY') {
        const res = await pay.razorpayLink.mutateAsync({ billId: bill.id, amountPaise, notify: 'whatsapp' });
        setLinkUrl(res.shortUrl);
        window.open(waMeLink(bill.patientPhone, `Pay here: ${res.shortUrl}`), '_blank');
      } else if (method === 'CASH') {
        await pay.cash.mutateAsync({ billId: bill.id, amountPaise });
      } else if (method === 'UPI_MANUAL') {
        await pay.upi.mutateAsync({ billId: bill.id, amountPaise, upiTxnRef: 'manual' });
      } else if (method === 'CARD_MANUAL') {
        await pay.card.mutateAsync({ billId: bill.id, amountPaise });
      }
      setAmount('');
      toast.success(method === 'RAZORPAY' ? 'Link sent' : 'Payment recorded');
    } catch (e) {
      onError(e);
    }
  }

  const step = bill ? checkoutStep(bill.status) : 'edit';

  return (
    <BottomSheet open={!!billId} onClose={onClose} title={bill ? `Bill ${bill.billNumber}` : 'Bill'}>
      {isLoading || !bill ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className={cn('rounded-pill px-2.5 py-1 text-xs font-medium', billStatusStyle(bill.status).pill)}>
              {billStatusStyle(bill.status).label}
            </span>
            <span className="font-mono text-sm tabular-nums text-text-muted">Due {rupees(bill.balancePaise)}</span>
          </div>

          <div className="divide-y divide-border rounded-lg border border-border bg-paper-warm">
            {bill.items.map((i) => (
              <div key={i.id} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-ink">{i.description}{i.quantity > 1 ? ` ×${i.quantity}` : ''}</span>
                <span className="font-mono tabular-nums text-ink">{rupees(i.subtotalPaise)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between px-3 py-2 text-sm font-semibold">
              <span className="text-ink">Total</span>
              <span className="font-mono tabular-nums text-ink">{rupees(bill.totalPaise)}</span>
            </div>
          </div>

          {step === 'edit' && (
            <>
              <VoiceInput
                mode="extraction"
                endpoint={`/bills/${bill.id}/dictate/items`}
                placement="sheet"
                label="Dictate line items"
                hint="“X-ray 300, scaling 1500, discount 200”"
                onExtraction={onItemsDictated}
              />
              <Button className="w-full" onClick={() => actions.finalize.mutate(undefined, { onError })} disabled={actions.finalize.isPending}>
                Finalize bill
              </Button>
            </>
          )}

          {canAddPayment(bill.status) && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {CHECKOUT_METHODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMethod(m)}
                    className={cn(
                      'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
                      method === m ? 'bg-lime text-ink' : 'bg-paper-warm text-text-muted',
                    )}
                  >
                    {methodLabel(m)}
                  </button>
                ))}
              </div>
              <Input type="number" inputMode="decimal" placeholder="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Button className="w-full" onClick={record} disabled={amountPaise <= 0 || pay.cash.isPending || pay.razorpayLink.isPending}>
                {method === 'RAZORPAY' ? 'Send Razorpay link' : 'Record payment'}
              </Button>
              {linkUrl && <p className="break-all text-xs text-text-subtle">Link: {linkUrl}</p>}
            </div>
          )}

          {bill.payments.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-text-subtle">Payments</p>
              {bill.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-paper-warm px-3 py-2 text-sm">
                  <span className="text-ink">{methodLabel(p.method)} · {p.status}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono tabular-nums text-ink">{rupees(p.amountPaise)}</span>
                    {canRefund(bill, isAdmin) && (p.status === 'SUCCEEDED' || p.status === 'PARTIAL_REFUND') && (
                      <button
                        type="button"
                        className="text-xs font-medium text-danger"
                        onClick={() =>
                          refund.mutate(
                            { paymentId: p.id, amountPaise: p.amountPaise - p.refundedAmountPaise, reason: 'Refund' },
                            { onError, onSuccess: () => toast.success('Refund recorded') },
                          )
                        }
                      >
                        Refund
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}
