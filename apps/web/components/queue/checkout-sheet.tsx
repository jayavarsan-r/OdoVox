'use client';

import { useState } from 'react';
import type { VisitWithPatient } from '@odovox/types';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompleteVisit } from '@/lib/queue/mutations';
import {
  buildCompleteBody,
  CheckoutFormSchema,
  defaultCheckoutForm,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  rupees,
  type CheckoutForm,
} from '@/lib/queue/checkout-form';
import { useVisitBill } from '@/lib/billing/api';
import { VoiceInput } from '@/components/voice/voice-input';
import { appendTranscript } from '@/lib/voice/voice-input';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** Receptionist checkout: payment (placeholder for Phase 8) + prescription handover + next visit. */
export function CheckoutSheet({
  visit,
  open,
  onClose,
}: {
  visit: VisitWithPatient | null;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const complete = useCompleteVisit();
  // Ensure the itemized bill exists the moment the sheet opens — its items carry the doctor's
  // dictated costs, so "Due" is never "—" (Phase 9.5 Issue 3).
  const { data: bill } = useVisitBill(visit?.id ?? null, open);
  const [form, setForm] = useState<CheckoutForm>(defaultCheckoutForm(visit?.billDuePaise ?? null));
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form whenever a different visit opens, then again when its bill arrives (the
  // bill's balance is the real due; the snapshot's billDuePaise is null until the bill exists).
  const [seededFor, setSeededFor] = useState<string | null>(null);
  const seedKey = visit ? `${visit.id}:${bill?.id ?? 'pending'}` : null;
  if (visit && seedKey && seededFor !== seedKey) {
    setSeededFor(seedKey);
    setForm(defaultCheckoutForm(bill?.balancePaise ?? visit.billDuePaise));
  }

  if (!visit) return null;
  const duePaise = bill?.balancePaise ?? visit.billDuePaise;
  const set = (patch: Partial<CheckoutForm>) => setForm((f) => ({ ...f, ...patch }));

  async function submit() {
    const parsed = CheckoutFormSchema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the form');
      return;
    }
    setError(null);
    try {
      await complete.mutateAsync({ id: visit!.id, body: buildCompleteBody(parsed.data) });
      toast.success(`${visit!.patient.name} checked out`);
      onClose();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not complete checkout');
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} title="Take payment">
      <div className="space-y-4">
        <div className="rounded-lg bg-paper-warm p-3">
          <div className="flex items-center justify-between">
            <span className="font-medium text-ink">{visit.patient.name}</span>
            <span className="text-sm text-text-muted">{visit.doctorName}</span>
          </div>
          {bill?.items.length ? (
            <div className="mt-2 space-y-1 border-t border-border pt-2">
              {bill.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <span className="min-w-0 flex-1 truncate text-text-muted">{item.description}</span>
                  <span className="font-mono tabular-nums text-ink">{rupees(item.subtotalPaise)}</span>
                </div>
              ))}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="text-text-muted">Due</span>
            <span className="font-mono text-lg font-semibold tabular-nums text-ink">{rupees(duePaise)}</span>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.takePayment} onChange={(e) => set({ takePayment: e.target.checked })} />
          Take payment now
        </label>

        {form.takePayment ? (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => set({ method: m })}
                  className={cn(
                    'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
                    form.method === m ? 'bg-lime text-ink' : 'bg-paper-warm text-text-muted',
                  )}
                >
                  {PAYMENT_METHOD_LABELS[m]}
                </button>
              ))}
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-text-subtle">Amount received (₹)</p>
              <Input
                type="number"
                inputMode="numeric"
                value={form.amountPaise / 100}
                onChange={(e) => set({ amountPaise: Math.round(Number(e.target.value) * 100) })}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Notes (optional)"
                value={form.notes ?? ''}
                onChange={(e) => set({ notes: e.target.value })}
                className="flex-1"
              />
              {/* Voice checkout notes (Phase 9.5 P1.6, migrated to <VoiceInput>): dictate "patient
                  will pay balance in two weeks" straight into the Notes field. STT only. */}
              <VoiceInput
                mode="notes"
                size="md"
                label="Dictate note"
                onTranscript={(t) => setForm((f) => ({ ...f, notes: appendTranscript(f.notes ?? '', t) }))}
              />
            </div>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.prescriptionHanded}
            onChange={(e) => set({ prescriptionHanded: e.target.checked })}
          />
          Prescription handed to patient
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.nextVisitConfirmed}
            onChange={(e) => set({ nextVisitConfirmed: e.target.checked })}
          />
          Next visit confirmed
        </label>

        {error ? <p className="text-xs text-danger">{error}</p> : null}
        <Button onClick={submit} loading={complete.isPending}>
          Complete checkout
        </Button>
      </div>
    </BottomSheet>
  );
}
