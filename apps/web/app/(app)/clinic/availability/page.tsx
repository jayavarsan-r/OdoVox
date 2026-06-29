'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueueSnapshot } from '@/lib/queue/mutations';
import { useQueueStore } from '@/lib/queue/store';
import { useCreateAvailability, useDeleteAvailability, useDoctorAvailability } from '@/lib/schedule/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function DoctorCard({ doctorId, name }: { doctorId: string; name: string }) {
  const toast = useToast();
  const { data, isLoading } = useDoctorAvailability(doctorId);
  const create = useCreateAvailability();
  const del = useDeleteAvailability();
  const [addDay, setAddDay] = useState(1);
  const [start, setStart] = useState('09:00');
  const [end, setEnd] = useState('18:00');

  const rows = data?.availability ?? [];

  async function add() {
    try {
      await create.mutateAsync({ doctorId, body: { dayOfWeek: addDay, startTime: start, endTime: end } });
      toast.success('Window added');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not add');
    }
  }

  return (
    <section className="rounded-xl border border-border bg-paper-warm p-4">
      <h2 className="mb-3 text-sm font-semibold">{name}</h2>
      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ul className="flex flex-col gap-1.5">
          {DAYS.map((label, dow) => {
            const dayRows = rows.filter((r) => r.dayOfWeek === dow);
            return (
              <li key={label} className="flex items-center gap-2 text-sm">
                <span className="w-10 shrink-0 text-text-subtle">{label}</span>
                {dayRows.length === 0 ? (
                  <span className="text-text-muted">Off</span>
                ) : (
                  <span className="flex flex-wrap gap-1.5">
                    {dayRows.map((r) => (
                      <span key={r.id} className="inline-flex items-center gap-1 rounded-pill bg-sage-soft px-2 py-0.5 text-xs tabular-nums">
                        {r.startTime}–{r.endTime}
                        <button type="button" aria-label="Remove" onClick={() => del.mutate(r.id)} className="text-ink/50 hover:text-destructive">
                          <Trash2 className="size-3" />
                        </button>
                      </span>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
        <select value={addDay} onChange={(e) => setAddDay(Number(e.target.value))} className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm">
          {DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}
        </select>
        <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-28" />
        <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" />
        <Button size="sm" onClick={add} loading={create.isPending}><Plus className="size-4" /> Add</Button>
      </div>
    </section>
  );
}

export default function AvailabilityPage() {
  useQueueSnapshot('all');
  const doctors = useQueueStore((s) => s.state.doctors);

  return (
    <AnimatedPage className="bg-paper">
      <div className="flex flex-col gap-5 px-4 pb-28 pt-4">
        <EditorialHeading eyebrow="CLINIC" title="Doctor availability" subtitle="Weekly working hours per doctor" />
        {doctors.length === 0 ? (
          <p className={cn('rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-subtle')}>No doctors yet.</p>
        ) : (
          doctors.map((d) => <DoctorCard key={d.id} doctorId={d.id} name={d.name} />)
        )}
      </div>
    </AnimatedPage>
  );
}
