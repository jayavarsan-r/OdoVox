'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Wallet } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EditorialHeading, EmptyState, StatTile } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useDailyCollection } from '@/lib/billing/api';
import { collectionStatTiles, methodLabel, rupees } from '@/lib/billing/format';
import type { PaymentMethod } from '@odovox/types';

/** Today's date in clinic-local YYYY-MM-DD (Asia/Kolkata) for the day-picker default. */
function todayISO(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export default function BillingPage() {
  const router = useRouter();
  const [date, setDate] = useState(todayISO());
  const { data, isLoading } = useDailyCollection(date === todayISO() ? undefined : date);

  const tiles = data ? collectionStatTiles(data, 0).slice(0, 3) : [];
  const methods = data ? (Object.entries(data.byMethod) as [PaymentMethod, number][]) : [];

  return (
    <AnimatedPage className="flex flex-1 flex-col">
      <div className="px-5 pt-4">
        <EditorialHeading eyebrow="BILLING" title="Collection" subtitle="Daily payments & dues" trailing={<ProfileButton />} />
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pb-28 pt-4">
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value || todayISO())}
          className="w-fit rounded-lg border border-border bg-surface px-3 py-2 text-sm text-ink"
        />

        {isLoading || !data ? (
          <ListSkeleton />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              {tiles.map((t) => (
                <StatTile key={t.label} value={t.value} label={t.label} variant={t.variant} />
              ))}
            </div>

            <button
              type="button"
              onClick={() => router.push('/billing/outstanding')}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-left"
            >
              <span className="text-sm font-medium text-ink">Outstanding dues</span>
              <ChevronRight className="size-4 text-text-subtle" />
            </button>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-subtle">By method</h2>
              {methods.length === 0 ? (
                <EmptyState variant="inline" icon={<Wallet className="size-5" />} title="No payments yet" body="Collected payments will appear here." />
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border bg-surface">
                  {methods.map(([method, paise]) => (
                    <div key={method} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-ink">{methodLabel(method)}</span>
                      <span className="font-mono text-sm tabular-nums text-ink">{rupees(paise)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-subtle">By doctor</h2>
              <div className="divide-y divide-border rounded-lg border border-border bg-surface">
                {data.byDoctor.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-text-subtle">—</p>
                ) : (
                  data.byDoctor.map((d) => (
                    <div key={d.doctorId} className="flex items-center justify-between px-4 py-3">
                      <span className="text-sm text-ink">{d.name}</span>
                      <span className="font-mono text-sm tabular-nums text-ink">{rupees(d.totalPaise)}</span>
                    </div>
                  ))
                )}
              </div>
            </section>

            <p className="text-xs text-text-subtle">
              {data.transactionCount} payment{data.transactionCount === 1 ? '' : 's'}
              {data.refundsCount > 0
                ? ` · ${data.refundsCount} refund${data.refundsCount === 1 ? '' : 's'} (${rupees(data.totalRefundedPaise)})`
                : ''}
            </p>
          </>
        )}
      </div>
    </AnimatedPage>
  );
}
