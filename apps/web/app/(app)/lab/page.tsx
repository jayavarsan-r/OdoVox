'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight, Plus, Truck } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EditorialHeading, EmptyState, FAB } from '@/components/ds';
import { ListSkeleton } from '@/components/ui/skeleton';
import { useLabCases, type LabCaseFilters } from '@/lib/lab-queries';
import { expectedReturnInfo, labCaseTypeLabel, labStatusStyle } from '@/lib/lab-ui';
import type { LabCaseStatus, LabCaseSummary } from '@odovox/types';
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
        <span className="flex items-center justify-between gap-2">
          <span className={cn('truncate font-mono text-xs font-semibold', s.strikethrough && 'line-through')}>
            {c.caseNumber}
          </span>
          <span className={cn('rounded-pill px-2 py-0.5 text-xs font-medium', s.pill)}>{s.label}</span>
        </span>
        <span className="truncate text-sm font-semibold">{c.patientName}</span>
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
  const [search, setSearch] = useState('');
  const filters: LabCaseFilters = { status, search: search || undefined };
  const query = useLabCases(filters);
  const cases = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-6 pb-28">
      <EditorialHeading title="Lab cases" trailing={<ProfileButton />} />

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
            onClick={() => setStatus(f.value)}
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
