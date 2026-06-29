'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ScheduleAppointment } from '@odovox/types';
import { CalendarClock, LogIn, XCircle } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlotPicker } from './slot-picker';
import { useCancelAppointment, useRescheduleAppointment, useSlots } from '@/lib/schedule/api';
import { appointmentSubtitle, durationLabel } from '@/lib/schedule/format';
import { formatLocalTime, localDateISO } from '@/lib/schedule/tz';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const CANCEL_REASONS = ['Patient requested', 'Doctor unavailable', 'Rescheduled by phone', 'Other'];

function longDate(d: Date, tz: string): string {
  const p = localDateISO(d, tz).split('-');
  const m = Number(p[1]);
  const day = Number(p[2]);
  const dow = new Date(Date.UTC(Number(p[0]), m - 1, day)).getUTCDay();
  return `${DAY[dow]} ${day} ${MON[m - 1]}`;
}

export function AppointmentDetailSheet({
  appt,
  tz,
  onClose,
}: {
  appt: ScheduleAppointment | null;
  tz: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const reschedule = useRescheduleAppointment();
  const cancel = useCancelAppointment();
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel'>('view');
  const [dateISO, setDateISO] = useState('');
  const [newStartsAt, setNewStartsAt] = useState<Date | null>(null);
  const [reason, setReason] = useState(CANCEL_REASONS[0]!);
  const [busy, setBusy] = useState(false);

  const open = !!appt;
  const slots = useSlots(dateISO, appt?.doctorId ?? '', appt?.durationMinutes ?? 30, mode === 'reschedule' && !!dateISO);

  function close() {
    setMode('view'); setNewStartsAt(null); setDateISO('');
    onClose();
  }

  async function doReschedule() {
    if (!appt || !newStartsAt) return;
    setBusy(true);
    try {
      await reschedule.mutateAsync({ id: appt.id, body: { newStartsAt } });
      toast.success('Rescheduled');
      close();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not reschedule');
    } finally {
      setBusy(false);
    }
  }

  async function doCancel() {
    if (!appt) return;
    setBusy(true);
    try {
      await cancel.mutateAsync({ id: appt.id, body: { reason } });
      toast.success('Appointment cancelled');
      close();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not cancel');
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title={appt?.patientName ?? 'Appointment'}>
      {appt ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-border bg-paper-warm p-3">
            <p className="text-sm font-semibold uppercase tracking-wide text-text-subtle">
              {longDate(new Date(appt.startsAt), tz)} · {formatLocalTime(new Date(appt.startsAt), tz)} – {formatLocalTime(new Date(appt.endsAt), tz)} ({durationLabel(appt.durationMinutes)})
            </p>
            {appt.doctorName ? <p className="mt-1 text-sm">{appt.doctorName}{appt.roomName ? ` · ${appt.roomName}` : ''}</p> : null}
            {appointmentSubtitle(appt) ? <p className="text-sm text-ink/70">{appointmentSubtitle(appt)}</p> : null}
            <span className={cn('mt-2 inline-block rounded-pill px-2 py-0.5 text-[11px] font-medium', appt.status === 'SCHEDULED' ? 'bg-sage-soft text-ink' : 'bg-border text-text-subtle')}>{appt.status}</span>
          </div>

          {mode === 'view' ? (
            <div className="flex flex-col gap-2">
              <Button variant="primary" onClick={() => router.push('/today')}><LogIn className="size-4" /> Check in</Button>
              <Button variant="outline" onClick={() => { setMode('reschedule'); setDateISO(localDateISO(new Date(appt.startsAt), tz)); }}><CalendarClock className="size-4" /> Reschedule</Button>
              <Button variant="ghost" onClick={() => setMode('cancel')}><XCircle className="size-4" /> Cancel appointment</Button>
            </div>
          ) : null}

          {mode === 'reschedule' ? (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium uppercase tracking-wide text-text-subtle">New date</span>
                <Input type="date" value={dateISO} onChange={(e) => { setDateISO(e.target.value); setNewStartsAt(null); }} />
              </label>
              <SlotPicker slots={slots.data?.slots ?? []} tz={tz} loading={slots.isLoading} selectedISO={newStartsAt?.toISOString() ?? null} onPick={setNewStartsAt} />
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setMode('view')} className="flex-1">Back</Button>
                <Button onClick={doReschedule} disabled={!newStartsAt || busy} loading={busy} className="flex-1">Confirm</Button>
              </div>
            </div>
          ) : null}

          {mode === 'cancel' ? (
            <div className="flex flex-col gap-3">
              <span className="text-xs font-medium uppercase tracking-wide text-text-subtle">Reason</span>
              <div className="flex flex-wrap gap-2">
                {CANCEL_REASONS.map((r) => (
                  <button key={r} type="button" onClick={() => setReason(r)} className={cn('rounded-pill border px-3 py-1.5 text-xs', reason === r ? 'border-lime bg-lime text-ink' : 'border-border bg-paper-warm')}>{r}</button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={() => setMode('view')} className="flex-1">Back</Button>
                <Button variant="destructive" onClick={doCancel} disabled={busy} loading={busy} className="flex-1">Cancel it</Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </BottomSheet>
  );
}
