'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarOff, ChevronLeft, User, X } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Mini } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueueSnapshot } from '@/lib/queue/mutations';
import { useQueueStore } from '@/lib/queue/store';
import { useCreateDayOff, useDayOffs, useDeleteDayOff } from '@/lib/schedule/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/**
 * Frame 74 — Days off.
 *
 * The scope selector names the doctors rather than offering a generic "A doctor" that then
 * reveals a second dropdown. A clinic has two or three dentists; making the user pick a
 * category and then pick the person is one step more than the choice actually contains.
 *
 * The amber note is a real behaviour, not reassurance: POST /day-offs rejects a date that
 * already has appointments with DAY_OFF_HAS_APPOINTMENTS and the count, which the catch
 * below surfaces. Blocking a day out from under a booked patient is the failure it prevents.
 */

/** "15 Aug" — the frame's date format, clinic-local. */
function shortDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

export default function DayOffPage() {
  const router = useRouter();
  const toast = useToast();
  useQueueSnapshot('all');
  const doctors = useQueueStore((s) => s.state.doctors);
  const { data, isLoading } = useDayOffs();
  const create = useCreateDayOff();
  const del = useDeleteDayOff();

  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  /** '' = whole clinic; otherwise a doctor id. One control, one decision. */
  const [scopeId, setScopeId] = useState('');

  const dayOffs = data?.dayOffs ?? [];
  const today = new Date().setHours(0, 0, 0, 0);
  const upcoming = dayOffs.filter(
    (d) => new Date(d.endDate ?? d.date).setHours(0, 0, 0, 0) >= today,
  );

  const doctorName = (id?: string | null) => doctors.find((d) => d.id === id)?.name ?? 'Doctor';

  async function add() {
    if (!date) return;
    try {
      await create.mutateAsync({
        date: new Date(date),
        scope: scopeId ? 'DOCTOR' : 'CLINIC',
        doctorId: scopeId || undefined,
        reason: reason || undefined,
      });
      toast.success('Day off added');
      setDate('');
      setReason('');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'DAY_OFF_HAS_APPOINTMENTS') {
        const n = (e.details as { appointments?: unknown[] })?.appointments?.length ?? 0;
        toast.error(`${n} appointment${n === 1 ? '' : 's'} already booked — move them first`);
      } else {
        toast.error(e instanceof ApiError ? e.message : 'Could not add');
      }
    }
  }

  const scopes = [
    { id: '', label: 'Whole clinic' },
    ...doctors.map((d) => ({ id: d.id, label: d.name })),
  ];

  return (
    <AnimatedPage className="bg-paper">
      <div className="flex flex-col gap-4 px-4 pb-28 pt-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => router.push('/more')}
            className="flex size-9 items-center justify-center rounded-pill hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
          <EditorialHeading className="flex-1" title="Days off" />
        </div>

        <section className="flex flex-col gap-3 rounded-2xl bg-white p-[15px] shadow-elev-1">
          {/* Scope: the clinic, or a named doctor. Scrolls when a clinic has several. */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5">
            {scopes.map((s) => (
              <button
                key={s.id || 'clinic'}
                type="button"
                onClick={() => setScopeId(s.id)}
                className={cn(
                  'shrink-0 rounded-pill px-[14px] py-2 text-xs font-heavy transition-colors',
                  scopeId === s.id
                    ? 'bg-white text-pine shadow-elev-1'
                    : 'bg-[rgba(31,42,35,0.05)] text-pine-3',
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Date and reason share a row, as the frame has them: one line, one decision. */}
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              aria-label="Date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Reason"
            />
          </div>

          <Button block onClick={add} loading={create.isPending} disabled={!date}>
            Add day off
          </Button>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="px-1 text-2xs font-heavy tracking-[0.06em] text-pine-3">UPCOMING</h2>
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-2xl" />
          ) : upcoming.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-hair-2 p-6 text-center text-xs font-semibold text-pine-3">
              Nothing blocked ahead.
            </p>
          ) : (
            <div className="rounded-2xl bg-white shadow-elev-1">
              {upcoming.map((d) => {
                const clinicWide = d.scope === 'CLINIC';
                return (
                  <div
                    key={d.id}
                    className="flex items-center gap-3 px-[15px] py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-hair"
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-pill',
                        clinicWide ? 'bg-crit-soft text-crit' : 'bg-warn-soft text-warn',
                      )}
                    >
                      {clinicWide ? (
                        <CalendarOff className="size-4" />
                      ) : (
                        <User className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-heavy text-pine">
                        {shortDate(d.date)}
                        {d.reason ? ` · ${d.reason}` : ''}
                      </span>
                      <Mini tone="neutral" className="mt-1">
                        {clinicWide ? 'Whole clinic' : doctorName(d.doctorId)}
                      </Mini>
                    </span>
                    <button
                      type="button"
                      aria-label={`Remove day off on ${shortDate(d.date)}`}
                      onClick={() => del.mutate(d.id)}
                      className="shrink-0 text-pine-3 hover:text-crit"
                    >
                      <X className="size-[18px]" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <p className="rounded-2xl bg-warn-soft px-4 py-3 text-xs font-bold leading-relaxed text-warn">
          A date with existing bookings can’t be blocked — Odovox names the count so those
          appointments get moved first.
        </p>
      </div>
    </AnimatedPage>
  );
}
