'use client';

import { useRouter } from 'next/navigation';
import { ChevronLeft, MessageCircle, CheckCircle2 } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { AnimatedNumber, EditorialHeading, EmptyState } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useOutstanding } from '@/lib/billing/api';
import { ageLabel, isStale, rupees, sortOutstanding } from '@/lib/billing/format';
import { Mini } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** "Anand Kumar" -> "AK". */
function initials(name: string): string {
  const w = name.trim().split(/\s+/).filter(Boolean);
  return (w[0]?.[0] ?? '?').concat(w[1]?.[0] ?? '').toUpperCase();
}

export default function OutstandingPage() {
  const router = useRouter();
  const { data, isLoading } = useOutstanding();
  const patients = data ? sortOutstanding(data.patients) : [];
  // sortOutstanding puts the longest-overdue first, so the head of the list IS the oldest.
  const oldest = patients[0];



  return (
    <AnimatedPage className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 px-5 pt-4">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.back()}
          className="flex size-9 shrink-0 items-center justify-center rounded-pill hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <EditorialHeading className="flex-1" title="Outstanding" />
      </div>

      <div className="flex flex-1 flex-col gap-3 px-5 pb-28 pt-4">
        {isLoading || !data ? (
          <ListSkeleton />
        ) : patients.length === 0 ? (
          <EmptyState variant="inline" icon={<CheckCircle2 className="size-5" />} title="All settled" body="No outstanding balances right now." />
        ) : (
          <>
            {/*
              Frame 55's hero, in crit. The total was a grey subtitle under the page title —
              "₹7,000 across 1" — which is the same weight the screen gives its own name. Money
              the clinic is owed is the reason anyone opens this, so it leads, and it carries
              the two facts that decide whether to act: how many people, and how old the
              oldest debt is.
            */}
            <section className="rounded-2xl bg-crit-soft p-4">
              <p className="text-2xs font-heavy tracking-[0.06em] text-crit">TOTAL OUTSTANDING</p>
              <AnimatedNumber
                value={data.totalOutstandingPaise}
                format={(n) => rupees(Math.round(n))}
                className="mt-1 block text-[34px] font-black leading-none text-crit"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-pill bg-white/80 px-2.5 py-1 text-3xs font-heavy text-pine">
                  {patients.length} patient{patients.length === 1 ? '' : 's'}
                </span>
                {oldest ? (
                  <span className="rounded-pill bg-white/80 px-2.5 py-1 text-3xs font-heavy text-pine">
                    oldest {ageLabel(oldest.oldestBillDate)}
                  </span>
                ) : null}
              </div>
            </section>

            <div className="rounded-2xl bg-white shadow-elev-1">
              {patients.map((p) => {
                const stale = isStale(p.oldestBillDate);
                return (
                  <div
                    key={p.patientId}
                    className="flex items-center gap-3 px-[15px] py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair"
                  >
                    <button
                      type="button"
                      aria-label={`Open ${p.name}`}
                      onClick={() => router.push(`/patients/${p.patientId}`)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      {/* The ring marks the debt that has stopped being an oversight. */}
                      <span
                        className={cn(
                          'flex size-10 shrink-0 items-center justify-center rounded-pill text-xs font-heavy',
                          stale
                            ? 'border-2 border-crit text-crit'
                            : 'border border-hair-2 text-pine-3',
                        )}
                      >
                        {initials(p.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        {/* WRAPS rather than truncating. "Akhilesh G…" on the screen you use
                            to chase someone for money is worse than a two-line name — frame 55
                            wraps "Anand Kumar" for exactly this reason. */}
                        <span className="block text-[14.5px] font-heavy leading-tight text-pine">
                          {p.name}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Mini tone={stale ? 'warn' : 'neutral'}>
                            {p.billCount} bill{p.billCount === 1 ? '' : 's'} ·{' '}
                            {ageLabel(p.oldestBillDate)}
                          </Mini>
                        </span>
                      </span>
                      <span className="shrink-0 text-[15px] font-heavy tabular-nums text-crit">
                        {rupees(p.balancePaise)}
                      </span>
                    </button>
                    {/* A pill, not a full-width bar: reminding is one of two things you can do
                        from this row, and it should not outweigh opening the record. */}
                    <button
                      type="button"
                      onClick={() => router.push(`/messages?patient=${p.patientId}`)}
                      className="flex shrink-0 items-center gap-1 rounded-pill bg-live-soft px-2.5 py-1.5 text-3xs font-heavy text-live"
                    >
                      <MessageCircle className="size-3" /> Remind
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </AnimatedPage>
  );
}
