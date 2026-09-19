'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, TriangleAlert } from 'lucide-react';
import type { PatientHistoryResponse } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { IconCircle } from '@/components/ds';
import { Chip, Mini } from '@/components/ui/badge';
import { Spinner } from '@/components/ui/spinner';
import { EmptyState } from '@/components/ds';
import { api } from '@/lib/api-client';
import { usePatient } from '@/lib/queries';
import { entryFacts, groupHistory } from '@/lib/patients/history-view';
import { cn } from '@/lib/utils';

/** Frame 42's filter. Narrows what the timeline shows without hiding that it did. */
type Filter = 'all' | 'treatment' | 'facts';
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'treatment', label: 'Treatment' },
  { id: 'facts', label: 'Medical' },
];

/**
 * `/patients/[id]/history` — frame 42.
 *
 * A route rather than a sixth tab: five tabs already crowd a 370px row (the labels had to
 * shrink when "Overview" truncated), and the plan leaves the choice open provided no
 * existing tab is removed. None is.
 *
 * The red node is the frame's own idea — a permanent medical fact rides the timeline
 * forever, because it constrains every prescription written after it. It only arrives for
 * clinical roles: the API withholds facts from reception entirely (B1/B4), so a
 * receptionist opening this page sees the operational timeline and no medical entries.
 */
export default function PatientHistoryPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');

  const patient = usePatient(id);
  const history = useQuery({
    queryKey: ['patient-history', id],
    queryFn: () => api.get<PatientHistoryResponse>(`/patients/${id}/history`),
    enabled: !!id,
  });

  const all = history.data?.entries ?? [];
  const entries = all.filter((e) =>
    filter === 'all' ? true : filter === 'facts' ? e.kind === 'fact' : e.kind === 'visit',
  );
  const groups = groupHistory(entries);
  const firstName = (patient.data?.name ?? '').split(/\s+/)[0] ?? '';

  return (
    <AnimatedPage className="flex flex-1 flex-col pb-28">
      <header className="flex items-center gap-2.5 px-gutter pt-2">
        <IconCircle size="md" tone="surface" aria-label="Back" onClick={() => router.push(`/patients/${id}`)}>
          <ChevronLeft />
        </IconCircle>
        <h1 className="min-w-0 flex-1 truncate text-[15px] font-heavy text-pine">
          {firstName ? `${firstName}'s history` : 'History'}
        </h1>
      </header>

      {/* The filter only appears where it has something to narrow — a patient with three
          visits does not need one. */}
      {all.length > 3 ? (
        <div className="mt-3 flex gap-1.5 px-gutter">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" onClick={() => setFilter(f.id)}>
              <Chip tone={filter === f.id ? 'pine' : 'neutral'}>{f.label}</Chip>
            </button>
          ))}
        </div>
      ) : null}

      {history.isLoading ? (
        <div className="flex flex-1 items-center justify-center"><Spinner /></div>
      ) : groups.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={<TriangleAlert />}
          iconTone="neutral"
          title="Nothing recorded yet"
          body="Visits and treatments will appear here once they happen."
        />
      ) : (
        <div className="mt-3.5 px-gutter">
          {groups.map((g) => (
            <section key={g.label ?? 'undated'} className="mb-4">
              <p className="mb-2 text-[9.5px] font-heavy uppercase tracking-eyebrow text-pine-3">
                {g.label ?? 'On record'}
              </p>
              <div className="flex flex-col gap-2">
                {g.entries.map((e) => {
                  const fact = e.kind === 'fact';
                  return (
                    <div
                      key={e.id}
                      className={cn(
                        'rounded-2xl bg-white p-3.5 shadow-elev-1',
                        // The frame draws a permanent medical fact in the verification
                        // rail's red — the same colour the app uses for a live allergy
                        // conflict, so the two read as one idea.
                        fact && 'border-l-[3px] border-l-crit',
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <p className={cn('min-w-0 flex-1 text-[14.5px] font-heavy', fact ? 'text-crit' : 'text-pine')}>
                          {e.title}
                        </p>
                        {e.at ? (
                          <span className="shrink-0 text-[10px] font-heavy uppercase tracking-eyebrow text-pine-3">
                            {new Date(e.at).toLocaleDateString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              timeZone: 'Asia/Kolkata',
                            })}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {entryFacts(e).map((f) => (
                          <Mini key={f} tone={fact ? 'crit' : 'neutral'}>{f}</Mini>
                        ))}
                        {e.confirmed ? <Mini tone="live">✓</Mini> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </AnimatedPage>
  );
}
