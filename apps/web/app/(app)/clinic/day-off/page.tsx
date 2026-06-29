'use client';

import { useState } from 'react';
import { CalendarOff, Plus, Trash2 } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueueSnapshot } from '@/lib/queue/mutations';
import { useQueueStore } from '@/lib/queue/store';
import { useCreateDayOff, useDayOffs, useDeleteDayOff } from '@/lib/schedule/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

export default function DayOffPage() {
  const toast = useToast();
  useQueueSnapshot('all');
  const doctors = useQueueStore((s) => s.state.doctors);
  const { data, isLoading } = useDayOffs();
  const create = useCreateDayOff();
  const del = useDeleteDayOff();

  const [date, setDate] = useState('');
  const [scope, setScope] = useState<'CLINIC' | 'DOCTOR'>('CLINIC');
  const [doctorId, setDoctorId] = useState('');
  const [reason, setReason] = useState('');

  const dayOffs = data?.dayOffs ?? [];

  async function add() {
    if (!date) return;
    try {
      await create.mutateAsync({
        date: new Date(date),
        scope,
        doctorId: scope === 'DOCTOR' ? doctorId || undefined : undefined,
        reason: reason || undefined,
      });
      toast.success('Day off added');
      setDate(''); setReason('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DAY_OFF_HAS_APPOINTMENTS') {
        const n = (e.details as { appointments?: unknown[] })?.appointments?.length ?? 0;
        toast.error(`${n} appointment(s) in that range — reschedule or cancel them first`);
      } else {
        toast.error(e instanceof ApiError ? e.message : 'Could not add');
      }
    }
  }

  return (
    <AnimatedPage className="bg-paper">
      <div className="flex flex-col gap-5 px-4 pb-28 pt-4">
        <EditorialHeading eyebrow="CLINIC" title="Days off & closures" subtitle="Block clinic days or a doctor's leave" />

        <section className="flex flex-col gap-3 rounded-xl border border-border bg-paper-warm p-4">
          <div className="flex gap-2">
            {(['CLINIC', 'DOCTOR'] as const).map((s) => (
              <button key={s} type="button" onClick={() => setScope(s)} className={cn('flex-1 rounded-pill border px-3 py-1.5 text-xs font-medium', scope === s ? 'border-lime bg-lime text-ink' : 'border-border')}>
                {s === 'CLINIC' ? 'Whole clinic' : 'A doctor'}
              </button>
            ))}
          </div>
          {scope === 'DOCTOR' ? (
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className="rounded-md border border-border bg-surface px-2 py-2 text-sm">
              <option value="">Select doctor…</option>
              {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          ) : null}
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" />
          <Button onClick={add} loading={create.isPending} disabled={!date || (scope === 'DOCTOR' && !doctorId)}>
            <Plus className="size-4" /> Add day off
          </Button>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-text-subtle">Blocked days</h2>
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : dayOffs.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-subtle">No days off scheduled.</p>
          ) : (
            dayOffs.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-xl border border-border bg-paper-warm px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <CalendarOff className="size-4 text-tool-dayoff" />
                  <div>
                    <p className="text-sm font-medium">{new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
                    <p className="text-xs text-text-subtle">{d.scope === 'CLINIC' ? 'Whole clinic' : 'Doctor'}{d.reason ? ` · ${d.reason}` : ''}</p>
                  </div>
                </div>
                <button type="button" aria-label="Delete" onClick={() => del.mutate(d.id)} className="text-text-subtle hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))
          )}
        </section>
      </div>
    </AnimatedPage>
  );
}
