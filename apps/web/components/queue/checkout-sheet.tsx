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
  rupees,
  type CheckoutForm,
} from '@/lib/queue/checkout-form';
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
  const [form, setForm] = useState<CheckoutForm>(defaultCheckoutForm(visit?.billDuePaise ?? null));
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form whenever a different visit opens.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (visit && seededFor !== visit.id) {
    setSeededFor(visit.id);
    setForm(defaultCheckoutForm(visit.billDuePaise));
  }

  if (!visit) return null;
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
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
            <span className="text-text-muted">Due</span>
            <span className="font-mono text-lg font-semibold tabular-nums text-ink">{rupees(visit.billDuePaise)}</span>
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
                  {m}
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
            <Input placeholder="Notes (optional)" value={form.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} />
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
