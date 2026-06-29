'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, Check, Circle, FileText, XCircle, CheckCircle2 } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Input } from '@/components/ui/input';
import { EditorialHeading } from '@/components/ds';
import { useToast } from '@/lib/toast';
import { usePlan, useCompletePlan, useCancelPlan, fetchPlanPdfUrl } from '@/lib/queries';
import { cn } from '@/lib/utils';

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-sage-tint text-sage-deep',
  COMPLETED: 'bg-sage text-ink',
  CANCELLED: 'bg-muted text-text-muted',
  ON_HOLD: 'bg-warning-soft text-ink',
  DRAFT: 'bg-muted text-text-muted',
};

export default function PlanDetailPage() {
  const { id: patientId, planId } = useParams<{ id: string; planId: string }>();
  const router = useRouter();
  const toast = useToast();
  const { data: plan, isLoading } = usePlan(planId);
  const completeMut = useCompletePlan(planId, patientId);
  const cancelMut = useCancelPlan(planId, patientId);

  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  if (isLoading || !plan) {
    return (
      <AnimatedPage>
        <div className="flex h-64 items-center justify-center"><Spinner /></div>
      </AnimatedPage>
    );
  }

  const proc = plan.procedures[0];
  const active = plan.status === 'ACTIVE';

  async function markComplete() {
    try {
      await completeMut.mutateAsync();
      toast.success('Plan marked complete.');
    } catch (err) {
      toast.apiError(err);
    }
  }

  async function doCancel() {
    if (!reason.trim()) return;
    try {
      await cancelMut.mutateAsync(reason.trim());
      toast.success('Plan cancelled.');
      setCancelOpen(false);
    } catch (err) {
      toast.apiError(err);
    }
  }

  async function viewPdf() {
    try {
      const url = await fetchPlanPdfUrl(planId);
      window.open(url, '_blank');
    } catch (err) {
      toast.apiError(err);
    }
  }

  return (
    <AnimatedPage>
      <div className="flex flex-col gap-5 px-4 pb-28 pt-4">
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Back" onClick={() => router.push(`/patients/${patientId}`)} className="flex size-9 items-center justify-center rounded-pill hover:bg-muted">
            <ChevronLeft className="size-5" />
          </button>
          <EditorialHeading className="flex-1" title="Treatment Plan" />
          <button type="button" aria-label="Case sheet PDF" onClick={viewPdf} className="flex size-9 items-center justify-center rounded-pill hover:bg-muted">
            <FileText className="size-5" />
          </button>
        </div>

        <div>
          <h2 className="font-display text-xl font-semibold text-ink">{plan.name}</h2>
          {proc ? (
            <p className="mt-0.5 text-sm text-text-muted">
              {proc.name}{proc.toothNumbers.length ? ` · Tooth ${proc.toothNumbers.join(', ')}` : ''}
            </p>
          ) : null}
          <span className={cn('mt-2 inline-block rounded-pill px-2.5 py-0.5 text-xs font-medium', STATUS_STYLE[plan.status] ?? 'bg-muted text-text-muted')}>
            {plan.status}
          </span>
        </div>

        {/* Progress */}
        <div className="rounded-lg border border-border bg-surface p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-ink">{plan.progress.completedSittings} of {plan.progress.totalSittings} sittings</span>
            {plan.estimatedCostPaise > 0 ? <span className="text-text-muted">Est. ₹{(plan.estimatedCostPaise / 100).toLocaleString('en-IN')}</span> : null}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-pill bg-muted">
            <div className="h-full rounded-pill bg-sage" style={{ width: `${plan.progress.percent}%` }} />
          </div>
        </div>

        {/* Sittings */}
        {proc ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-muted">Sittings</p>
            <div className="flex flex-col gap-2">
              {Array.from({ length: proc.totalSittings }, (_, i) => i + 1).map((n) => {
                const s = proc.sittings.find((x) => x.sittingNumber === n);
                const done = s?.completed ?? false;
                const isNext = !done && n === proc.completedSittings + 1;
                return (
                  <div key={n} className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
                    {done ? <Check className="mt-0.5 size-4 shrink-0 text-sage-deep" /> : <Circle className={cn('mt-0.5 size-4 shrink-0', isNext ? 'text-sage' : 'text-border')} />}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-ink">
                        Sitting {n}{isNext ? ' · (next)' : !done ? ' · (pending)' : ''}
                      </p>
                      {s ? (
                        <p className="text-xs text-text-muted">
                          {new Date(s.date).toLocaleDateString('en-IN')}{s.notes ? ` · ${s.notes}` : ''}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Actions */}
        {active ? (
          <div className="flex flex-col gap-2">
            <Button onClick={markComplete} loading={completeMut.isPending}>
              <CheckCircle2 className="size-4" /> Mark plan complete
            </Button>
            <Button variant="ghost" className="text-danger" onClick={() => setCancelOpen(true)}>
              <XCircle className="size-4" /> Cancel plan
            </Button>
          </div>
        ) : plan.status === 'CANCELLED' && plan.cancellationReason ? (
          <div className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-text-muted">
            Cancelled{plan.cancelledAt ? ` on ${new Date(plan.cancelledAt).toLocaleDateString('en-IN')}` : ''}: “{plan.cancellationReason}”
          </div>
        ) : null}

        {plan.description ? (
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-text-muted">Notes</p>
            <p className="text-sm text-ink">{plan.description}</p>
          </div>
        ) : null}
      </div>

      <BottomSheet open={cancelOpen} onClose={() => setCancelOpen(false)} title="Cancel plan">
        <div className="flex flex-col gap-3">
          <p className="text-sm text-text-muted">This stops the plan and all its procedures. A future consultation will start a new plan instead of continuing this one.</p>
          <Input placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Button variant="destructive" disabled={!reason.trim()} loading={cancelMut.isPending} onClick={doCancel}>
            Cancel this plan
          </Button>
        </div>
      </BottomSheet>
    </AnimatedPage>
  );
}
