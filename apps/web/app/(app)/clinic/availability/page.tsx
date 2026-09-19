'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading, Segmented } from '@/components/ds';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useQueueSnapshot } from '@/lib/queue/mutations';
import { useQueueStore } from '@/lib/queue/store';
import {
  useCreateAvailability,
  useDeleteAvailability,
  useDoctorAvailability,
} from '@/lib/schedule/api';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';

/**
 * Frame 73 — Availability.
 *
 * The frame's anatomy, and the reasons each part is there:
 *
 *   - one doctor at a time, chosen by a tab, NOT every doctor stacked. A clinic with four
 *     dentists produced four scrolling cards and no way to compare them;
 *   - a row per weekday, uppercase, with its windows as chips and a `+` ON the row. Adding
 *     Tuesday's afternoon means tapping Tuesday, not scrolling to a form at the bottom and
 *     re-selecting the day you were already looking at;
 *   - "Copy Monday to weekdays", because a clinic's Tue-Fri are almost always Monday, and
 *     entering them four times is the kind of work software exists to remove.
 *
 * The footnote is load-bearing rather than decorative: these hours ARE the booking slots, so
 * editing them here silently changes what the schedule screens offer.
 */

const DAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
/** Mon-Fri. Saturday is excluded: clinics keep short Saturdays, which is why it has its own row. */
const WEEKDAYS = [2, 3, 4, 5];

function DayRow({
  label,
  dow,
  rows,
  onAdd,
  onRemove,
}: {
  label: string;
  dow: number;
  rows: { id: string; startTime: string; endTime: string }[];
  onAdd: (dow: number) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex items-center gap-3 border-b border-hair py-2.5 last:border-b-0">
      <span className="w-9 shrink-0 text-2xs font-heavy tracking-[0.06em] text-pine">{label}</span>
      <span className="flex min-w-0 flex-1 flex-wrap gap-1.5">
        {rows.length === 0 ? (
          <span className="rounded-2xs bg-[rgba(31,42,35,0.05)] px-2 py-1 text-3xs font-heavy text-pine-3">
            Off
          </span>
        ) : (
          rows.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center gap-1 rounded-2xs bg-lime-soft px-2 py-1 text-3xs font-heavy tabular-nums text-[#5c7013]"
            >
              {r.startTime}–{r.endTime}
              <button
                type="button"
                aria-label={`Remove ${label} ${r.startTime} to ${r.endTime}`}
                onClick={() => onRemove(r.id)}
                className="text-[#5c7013]/60 hover:text-crit"
              >
                <Trash2 className="size-3" />
              </button>
            </span>
          ))
        )}
      </span>
      <button
        type="button"
        aria-label={`Add a window on ${label}`}
        onClick={() => onAdd(dow)}
        className="flex size-7 shrink-0 items-center justify-center rounded-pill bg-[rgba(31,42,35,0.05)] text-pine hover:bg-[rgba(31,42,35,0.09)]"
      >
        <Plus className="size-[15px]" />
      </button>
    </li>
  );
}

function DoctorAvailability({ doctorId }: { doctorId: string }) {
  const toast = useToast();
  const { data, isLoading } = useDoctorAvailability(doctorId);
  const create = useCreateAvailability();
  const del = useDeleteAvailability();

  /** Which day's add-form is open. Null = none; the form belongs to the row that opened it. */
  const [addingDow, setAddingDow] = useState<number | null>(null);
  const [start, setStart] = useState('09:30');
  const [end, setEnd] = useState('13:00');

  const rows = data?.availability ?? [];
  const byDay = (dow: number) => rows.filter((r) => r.dayOfWeek === dow);

  async function add(dow: number) {
    try {
      await create.mutateAsync({
        doctorId,
        body: { dayOfWeek: dow, startTime: start, endTime: end },
      });
      setAddingDow(null);
      toast.success('Window added');
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not add');
    }
  }

  /**
   * Copy Monday's windows onto Tue-Fri, skipping any a day already has.
   *
   * Skipping rather than replacing: a clinic that has already given Wednesday a different
   * afternoon meant it, and silently overwriting it would lose a deliberate edit. The
   * duplicate check is client-side because the constraint that should prevent it does not
   * fire (see deviation #110).
   */
  async function copyMondayToWeekdays() {
    const monday = byDay(1);
    if (monday.length === 0) {
      toast.info('Set Monday first, then copy it across.');
      return;
    }
    try {
      let added = 0;
      for (const dow of WEEKDAYS) {
        const existing = byDay(dow);
        for (const m of monday) {
          const already = existing.some(
            (e) => e.startTime === m.startTime && e.endTime === m.endTime,
          );
          if (already) continue;
          await create.mutateAsync({
            doctorId,
            body: { dayOfWeek: dow, startTime: m.startTime, endTime: m.endTime },
          });
          added += 1;
        }
      }
      toast.success(
        added === 0
          ? 'Tue–Fri already match Monday'
          : `Copied to ${added} slot${added > 1 ? 's' : ''}`,
      );
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not copy');
    }
  }

  if (isLoading) return <Skeleton className="h-64 w-full rounded-2xl" />;

  return (
    <>
      <div className="rounded-2xl bg-white px-[15px] shadow-elev-1">
        <ul className="flex flex-col">
          {DAYS.map((label, dow) => (
            <DayRow
              key={label}
              label={label}
              dow={dow}
              rows={byDay(dow)}
              onAdd={(d) => setAddingDow(addingDow === d ? null : d)}
              onRemove={(id) => del.mutate(id)}
            />
          ))}
        </ul>
      </div>

      {addingDow !== null ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-white p-[15px] shadow-elev-1">
          <span className="text-2xs font-heavy tracking-[0.06em] text-pine-3">
            ADD TO {DAYS[addingDow]}
          </span>
          <Input
            type="time"
            aria-label="Start time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-[104px]"
          />
          <Input
            type="time"
            aria-label="End time"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-[104px]"
          />
          <Button size="sm" onClick={() => add(addingDow)} loading={create.isPending}>
            Add
          </Button>
        </div>
      ) : null}

      {/* `outline`, matching the frame: a white pill with dark text. This is a convenience,
          not the screen's primary action — the primary action is editing a day. */}
      <Button variant="outline" block onClick={copyMondayToWeekdays} loading={create.isPending}>
        Copy Monday to weekdays
      </Button>

      <p className="px-1 text-3xs font-bold text-pine-3">
        Changes update booking slots instantly — the schedule only ever offers these hours.
      </p>
    </>
  );
}

export default function AvailabilityPage() {
  const router = useRouter();
  useQueueSnapshot('all');
  const doctors = useQueueStore((s) => s.state.doctors);
  const [selected, setSelected] = useState<string | null>(null);

  const doctorId = selected ?? doctors[0]?.id ?? null;

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
          <EditorialHeading className="flex-1" title="Availability" />
        </div>

        {doctors.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-subtle">
            No doctors yet.
          </p>
        ) : (
          <>
            {/* One tab per doctor. With a single dentist the switcher says nothing, so it
                is omitted rather than shown as a lone selected tab. */}
            {doctors.length > 1 ? (
              <Segmented
                label="Doctor"
                options={doctors.map((d) => ({ label: d.name, value: d.id }))}
                value={doctorId ?? doctors[0]!.id}
                onChange={setSelected}
              />
            ) : (
              <h2 className="px-1 text-[13.5px] font-heavy text-pine">{doctors[0]!.name}</h2>
            )}
            {doctorId ? <DoctorAvailability key={doctorId} doctorId={doctorId} /> : null}
          </>
        )}
      </div>
    </AnimatedPage>
  );
}
