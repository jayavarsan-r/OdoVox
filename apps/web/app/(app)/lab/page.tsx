'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight, Plus, Truck } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EditorialHeading, EmptyState, FAB } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useLabCases, useLabStats, type LabCaseFilters } from '@/lib/lab-queries';
import { expectedReturnInfo, labCaseTypeLabel, labStatusStyle } from '@/lib/lab-ui';
import type { LabBucket, LabCaseStatus, LabCaseSummary } from '@odovox/types';
import { cn } from '@/lib/utils';

const FILTERS: { value?: LabCaseStatus; label: string }[] = [
  { value: undefined, label: 'All' },
  { value: 'SENT', label: 'Sent' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'READY', label: 'Ready' },
  { value: 'DELIVERED', label: 'Delivered' },
];

const dueToneClass: Record<string, string> = {
  normal: 'text-text-subtle',
  warning: 'text-peach-deep',
  overdue: 'text-danger',
};

function CaseCard({ c, onClick }: { c: LabCaseSummary; onClick: () => void }) {
  const s = labStatusStyle(c.status);
  const due = expectedReturnInfo(c.expectedReturnAt);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-stretch overflow-hidden rounded-lg border border-border bg-surface text-left shadow-elev-1 transition-shadow active:shadow-elev-2"
    >
      <span className={cn('w-1 shrink-0', s.bar)} />
      <span className="flex flex-1 flex-col gap-0.5 p-3">
        {/*
          The PATIENT leads, with the case number beside it in a quieter weight — frame 56's
          ordering, and the right one: a receptionist scans this list for a person, not for
          LC-SM0003CC. The code led before, so every row opened with eight characters nobody
          reads until they already know which case they want.
        */}
        <span className="flex items-baseline justify-between gap-2">
          <span className="min-w-0 truncate">
            <span className={cn('text-sm font-heavy text-pine', s.strikethrough && 'line-through')}>
              {c.patientName}
            </span>
            <span className="ml-1.5 font-mono text-xs font-semibold text-pine-3">
              {c.caseNumber}
            </span>
          </span>
          <span className={cn('shrink-0 rounded-pill px-2 py-0.5 text-xs font-medium', s.pill)}>
            {s.label}
          </span>
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {labCaseTypeLabel(c.type)}
          {c.teeth.length > 0 ? ` · Tooth ${c.teeth.join(', ')}` : ''}
          {c.material ? ` · ${c.material}` : ''}
          {c.shade ? ` · ${c.shade}` : ''}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-text-subtle">{c.vendorName ?? 'No vendor'}</span>
          {due ? <span className={cn('text-xs font-medium', dueToneClass[due.tone])}>{due.label}</span> : null}
        </span>
      </span>
      <span className="flex items-center pr-2">
        <ChevronRight className="size-4 text-text-subtle" />
      </span>
    </button>
  );
}

export default function LabPage() {
  const router = useRouter();
  const [status, setStatus] = useState<LabCaseStatus | undefined>(undefined);
  const [bucket, setBucket] = useState<LabBucket | undefined>(undefined);
  const [search, setSearch] = useState('');
  const filters: LabCaseFilters = { status, bucket, search: search || undefined };
  const query = useLabCases(filters);
  const stats = useLabStats();
  const cases = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-6 pb-28">
      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Back"
          onClick={() => router.push('/more')}
          className="flex size-9 shrink-0 items-center justify-center rounded-pill hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </button>
        <EditorialHeading
          className="flex-1"
          title="Lab"
          trailing={
            <span className="flex items-center gap-2">
              {/* The frame's Vendors pill. The route existed and nothing on this screen
                  reached it — you had to know the URL. */}
              <button
                type="button"
                onClick={() => router.push('/lab/vendors')}
                className="rounded-pill bg-[rgba(31,42,35,0.05)] px-[13px] py-2 text-xs font-heavy text-pine"
              >
                Vendors
              </button>
              <ProfileButton />
            </span>
          }
        />
      </div>

      {/*
        Frame 56's name is the instruction: "stat pills, not tiles". Three numbers that say
        what the clinic is waiting on, and each one FILTERS — a stat you cannot act on is
        decoration.

        The counts and the filters read the same server-side definitions
        (apps/api/src/lib/lab/buckets.ts), so tapping "1 OVERDUE" cannot open onto a
        different number of rows than the pill promised. That is asserted in
        apps/api/test/lab-buckets.test.ts.
      */}
      <div className="grid grid-cols-3 gap-2">
        {([
          { id: undefined, label: 'ACTIVE', n: stats.data?.active, tone: 'bg-white text-pine shadow-elev-1' },
          { id: 'overdue' as const, label: 'OVERDUE', n: stats.data?.overdue, tone: 'bg-crit-soft text-crit' },
          { id: 'ready' as const, label: 'READY', n: stats.data?.ready, tone: 'bg-live-soft text-live' },
        ]).map((p) => {
          // "ACTIVE" is the unfiltered view of work in flight, so it doubles as Clear.
          const target = p.id ?? 'active';
          const on = bucket === target || (p.id === undefined && bucket === undefined);
          return (
            <button
              key={p.label}
              type="button"
              onClick={() => {
                setStatus(undefined);
                setBucket(p.id === undefined && bucket === undefined ? 'active' : p.id);
              }}
              className={cn(
                'rounded-2xl px-3 py-2.5 text-left transition-shadow',
                p.tone,
                on ? 'ring-2 ring-pine/15' : null,
              )}
            >
              <span className="block text-[19px] font-black leading-none tabular-nums">
                {p.n ?? '—'}
              </span>
              <span className="mt-1 block text-3xs font-heavy tracking-[0.06em] opacity-70">
                {p.label}
              </span>
            </button>
          );
        })}
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by case # or patient"
        className="w-full rounded-lg border border-border bg-surface px-4 py-2.5 text-sm outline-none focus:border-border-strong"
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => {
              setBucket(undefined);
              setStatus(f.value);
            }}
            className={cn(
              'rounded-pill px-3 py-1.5 text-xs font-medium transition-colors',
              status === f.value ? 'bg-ink text-paper' : 'bg-paper-warm text-text-subtle',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : cases.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<Truck className="size-5" />}
          title="No lab cases yet"
          body="Create a case when you take an impression — track it from sent to delivered."
        />
      ) : (
        <>
          <p className="text-xs font-medium uppercase tracking-wide text-text-subtle">{cases.length} cases</p>
          <div className="flex flex-col gap-2">
            {cases.map((c) => (
              <CaseCard key={c.id} c={c} onClick={() => router.push(`/lab/${c.id}`)} />
            ))}
          </div>
          {query.hasNextPage ? (
            <button
              type="button"
              onClick={() => query.fetchNextPage()}
              className="mx-auto mt-2 rounded-pill bg-paper-warm px-4 py-2 text-xs font-medium text-text-subtle"
            >
              Load more
            </button>
          ) : null}
        </>
      )}

      <FAB icon={<Plus className="size-5" />} label="New case" onClick={() => router.push('/lab/new')} />
    </AnimatedPage>
  );
}
