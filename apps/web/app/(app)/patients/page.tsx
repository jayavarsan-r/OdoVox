'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Calendar, UserPlus, TriangleAlert } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { VoiceSearchInput } from '@/components/voice-search-input';
import { EditorialHeading, EmptyState, FabMenu } from '@/components/ds';
import { IlluHappyTooth } from '@/components/illustrations';
import { ListSkeleton } from '@/components/ui/skeleton';
import { usePatients } from '@/lib/queries';
import { initials, statusStyle, rupees } from '@/lib/patient-ui';
import type { PatientFilter, PatientListItem } from '@odovox/types';
import { cn } from '@/lib/utils';

const FILTERS: { value: PatientFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'in_chair', label: 'In chair' },
  { value: 'due_today', label: 'Due today' },
  { value: 'lab_pending', label: 'Lab pending' },
  { value: 'recent', label: 'Recent' },
];

function PatientCard({ p, onClick }: { p: PatientListItem; onClick: () => void }) {
  const s = statusStyle(p.status);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-stretch overflow-hidden rounded-lg border border-border bg-surface text-left shadow-elev-1 transition-shadow active:shadow-elev-2"
    >
      <span className={cn('w-1 shrink-0', s.bar)} />
      <span className="flex flex-1 items-center gap-3 p-3">
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-pill text-sm font-semibold', s.avatar)}>
          {initials(p.name)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold">{p.name}</span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {p.age} · {p.chiefComplaint || '—'} · {p.phone.slice(-5)}
          </span>
        </span>
        {p.outstandingPaise > 0 ? (
          <span className="text-sm font-semibold text-danger">{rupees(p.outstandingPaise)}</span>
        ) : p.status === 'LAB_PENDING' ? (
          <span className="rounded-pill bg-sky-soft px-2 py-0.5 text-xs font-medium text-ink">Lab</span>
        ) : (
          <ChevronRight className="size-4 text-text-subtle" />
        )}
      </span>
    </button>
  );
}

function PatientsInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? '');
  const [filter, setFilter] = useState<PatientFilter>('all');
  const query = usePatients(search, filter);

  const all = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-4 px-5 pt-6">
      <EditorialHeading title="Patients" trailing={<ProfileButton />} />

      <VoiceSearchInput value={search} onChange={setSearch} placeholder="Name, phone, or patient ID" />

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={cn(
              'shrink-0 rounded-pill border px-3.5 py-1.5 text-sm font-medium transition-colors',
              filter === f.value
                ? 'border-ink bg-ink text-paper'
                : 'border-transparent bg-paper-warm text-text-muted hover:bg-muted',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <ListSkeleton />
      ) : query.isError ? (
        <EmptyState variant="inline" icon={<TriangleAlert />} iconTone="peach" title="Couldn't load patients" body="Pull to retry." />
      ) : all.length === 0 ? (
        <EmptyState
          variant="page"
          illustration={<IlluHappyTooth />}
          title="No patients yet"
          body="Add your first patient with the + button below."
        />
      ) : (
        <>
          <p className="text-xs font-semibold tracking-widest text-text-subtle">{all.length} PATIENTS</p>
          <div className="space-y-2.5">
            {all.map((p) => (
              <PatientCard key={p.id} p={p} onClick={() => router.push(`/patients/${p.id}`)} />
            ))}
          </div>
          {query.hasNextPage ? (
            <button
              type="button"
              onClick={() => query.fetchNextPage()}
              disabled={query.isFetchingNextPage}
              className="mx-auto mt-1 rounded-pill px-4 py-2 text-sm font-medium text-muted-foreground"
            >
              {query.isFetchingNextPage ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </>
      )}

      <FabMenu
        items={[
          {
            id: 'new-patient',
            label: 'New patient',
            tone: 'peach',
            icon: <UserPlus />,
            onClick: () => router.push('/patients/new'),
          },
          {
            id: 'new-appointment',
            label: 'New appointment',
            tone: 'sky',
            icon: <Calendar />,
            onClick: () => router.push('/schedule?dictate=1'),
          },
        ]}
      />
    </AnimatedPage>
  );
}

export default function PatientsPage() {
  return (
    <Suspense fallback={<ListSkeleton />}>
      <PatientsInner />
    </Suspense>
  );
}
