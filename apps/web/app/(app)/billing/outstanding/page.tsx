'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, MessageCircle, CheckCircle2 } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading, EmptyState } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useOutstanding } from '@/lib/billing/api';
import { daysSince, rupees, sortOutstanding } from '@/lib/billing/format';

export default function OutstandingPage() {
  const router = useRouter();
  const { data, isLoading } = useOutstanding();
  const patients = data ? sortOutstanding(data.patients) : [];

  return (
    <AnimatedPage className="flex flex-1 flex-col">
      <div className="px-5 pt-4">
        <button type="button" onClick={() => router.back()} className="mb-2 flex items-center gap-1 text-sm text-text-muted">
          <ArrowLeft className="size-4" /> Billing
        </button>
        <EditorialHeading
          eyebrow="BILLING"
          title="Outstanding"
          subtitle={data ? `${rupees(data.totalOutstandingPaise)} across ${patients.length}` : 'Dues by patient'}
        />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-28 pt-4">
        {isLoading || !data ? (
          <ListSkeleton />
        ) : patients.length === 0 ? (
          <EmptyState variant="inline" icon={<CheckCircle2 className="size-5" />} title="All settled" body="No outstanding balances right now." />
        ) : (
          patients.map((p) => {
            const days = daysSince(p.oldestBillDate);
            return (
              <button
                key={p.patientId}
                type="button"
                onClick={() => router.push(`/patients/${p.patientId}`)}
                className="rounded-lg border border-border bg-surface p-4 text-left"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{p.name}</p>
                    <p className="mt-0.5 text-xs text-text-subtle">
                      {p.billCount} bill{p.billCount === 1 ? '' : 's'} · oldest {days} day{days === 1 ? '' : 's'} ago
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums text-peach-deep">{rupees(p.balancePaise)}</span>
                </div>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-lime-soft px-3 py-1.5 text-xs font-medium text-ink">
                  <MessageCircle className="size-3.5" /> Remind via WhatsApp
                </span>
              </button>
            );
          })
        )}
      </div>
    </AnimatedPage>
  );
}
