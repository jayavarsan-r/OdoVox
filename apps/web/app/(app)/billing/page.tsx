'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Wallet } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { AnimatedNumber, EditorialHeading, EmptyState } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Mini } from '@/components/ui/badge';
import { formatLocalTime } from '@/lib/schedule/tz';
import { cn } from '@/lib/utils';

/**
 * This response carries no timezone, and the product is single-market: ₹ INR, +91,
 * Asia/Kolkata, DD/MM/YYYY (CLAUDE.md). Reading the clinic's own timezone here would mean a
 * second request purely to format four timestamps.
 */
const CLINIC_TZ = 'Asia/Kolkata';
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
  // ALWAYS send the date. Omitting it "because it is today" made the API fall back to the
  // SERVER's today — so the screen asked for one day and was answered about another whenever
  // the two clocks disagreed. That is every client in a different timezone, every device with
  // a wrong clock, and the capture harness, which pins the browser to a fixed date. It failed
  // silently as ₹0 collected, which on a billing screen reads as a quiet day rather than a bug.
  const { data, isLoading } = useDailyCollection(date);

  const tiles = data ? collectionStatTiles(data, 0).slice(0, 3) : [];
  const methods = data ? (Object.entries(data.byMethod) as [PaymentMethod, number][]) : [];

  return (
    <AnimatedPage className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-5 pt-4">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.push('/more')}
          className="flex size-9 shrink-0 items-center justify-center rounded-pill hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <EditorialHeading className="flex-1" title="Billing" trailing={<ProfileButton />} />
      </div>

      <div className="flex flex-1 flex-col gap-5 px-5 pb-28 pt-4">
        {/* The date sits with the money it describes, not floating above the screen. */}

        {isLoading || !data ? (
          <ListSkeleton />
        ) : (
          <>
            {/*
              Frame 54's hero. Three equal grey tiles said "collected", "cash", "online" in the
              same voice — but only one of those is the number a receptionist closing the day
              actually wants. It leads now, at hero size, with the split beneath it.
            */}
            <section className="rounded-2xl bg-lime-soft p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-2xs font-heavy tracking-[0.06em] text-[#5c7013]">
                    COLLECTED {date === todayISO() ? 'TODAY' : ''}
                  </p>
                  {/* Ticks when the day's takings change — a figure that swaps makes you
                      re-read it to work out whether it moved. */}
                  <AnimatedNumber
                    value={data.totalCollectedPaise}
                    format={(n) => rupees(Math.round(n))}
                    className="mt-1 block text-[34px] font-black leading-none text-pine"
                  />
                </div>
                <span className="flex items-center gap-2">
                  <input
                    type="date"
                    aria-label="Date"
                    value={date}
                    max={todayISO()}
                    onChange={(e) => setDate(e.target.value || todayISO())}
                    className="rounded-pill bg-white/70 px-2.5 py-1.5 text-xs font-heavy text-pine"
                  />
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <span className="rounded-pill bg-white/80 px-2.5 py-1 text-3xs font-heavy text-pine">
                  {data.transactionCount} payment{data.transactionCount === 1 ? '' : 's'}
                </span>
                {data.refundsCount > 0 ? (
                  <span className="rounded-pill bg-white/80 px-2.5 py-1 text-3xs font-heavy text-crit">
                    {data.refundsCount} refund{data.refundsCount === 1 ? '' : 's'} ·{' '}
                    {rupees(data.totalRefundedPaise)}
                  </span>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                {tiles.slice(1, 3).map((t) => (
                  <div key={t.label} className="rounded-xl bg-white px-3 py-2.5">
                    <p className="text-[15px] font-black tabular-nums text-pine">{t.value}</p>
                    <p className="text-3xs font-heavy tracking-[0.06em] text-pine-3">
                      {t.label.toUpperCase()}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <button
              type="button"
              onClick={() => router.push('/billing/outstanding')}
              className="flex items-center justify-between rounded-lg border border-border bg-surface px-4 py-3 text-left"
            >
              <span className="text-sm font-medium text-ink">Outstanding dues</span>
              <ChevronRight className="size-4 text-text-subtle" />
            </button>

            {/*
              Frame 54's "Latest". The screen totalled the day without ever showing WHAT
              happened in it — so a figure that looked wrong could not be checked without
              leaving for the bills list. Refunds appear here, signed, even though the total
              above deliberately excludes them.
            */}
            {data.recent.length > 0 ? (
              <section>
                <h2 className="mb-2 px-1 text-2xs font-heavy tracking-[0.06em] text-pine-3">
                  LATEST
                </h2>
                <div className="rounded-2xl bg-white shadow-elev-1">
                  {data.recent.slice(0, 6).map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center gap-2 px-[15px] py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-heavy text-pine">
                        {r.patientName}
                        <span className="ml-1.5 text-xs font-semibold text-pine-3">
                          {formatLocalTime(new Date(r.receivedAt), CLINIC_TZ)}
                        </span>
                      </span>
                      <Mini tone="neutral">{methodLabel(r.method)}</Mini>
                      <span
                        className={cn(
                          'shrink-0 text-[13px] font-heavy tabular-nums',
                          r.isRefund ? 'text-crit' : 'text-live',
                        )}
                      >
                        {r.isRefund ? '−' : '+'}
                        {rupees(r.amountPaise)}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

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
