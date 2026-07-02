'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppointmentExtraction, Conflict, PatientListItem } from '@odovox/types';
import { AlertTriangle, Check, Search } from 'lucide-react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SlotPicker } from './slot-picker';
import { VoiceInput } from '@/components/voice/voice-input';
import { usePatients } from '@/lib/queries';
import { useCreateAppointment, useCreateRecurring, useSlots } from '@/lib/schedule/api';
import { deriveConflictBanner } from '@/lib/schedule/conflict-view';
import { previewSeries } from '@/lib/schedule/recurring-preview';
import { formatLocalTime } from '@/lib/schedule/tz';
import { api, ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const DURATIONS = [15, 30, 45, 60, 90];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso: string) => {
  const p = iso.split('-');
  return `${Number(p[2])} ${MON[Number(p[1]) - 1]}`;
};

/** The /appointments/dictate response shape (Phase 9.7 W1.2.5). */
interface ApptDictateResponse {
  extraction: AppointmentExtraction;
  suggestedDateTime: string | null;
  dateMatchedText: string | null;
  dateHasTime: boolean;
  durationMinutes: number;
  patientMatches: Array<{ id: string; name: string; phone: string; age: number }>;
  doctorMatches: Array<{ id: string; name: string }>;
  conflicts: Conflict[] | null;
  transcript: string;
}

export function NewAppointmentSheet({
  open,
  onClose,
  tz,
  defaultDateISO,
  doctors,
  lockedDoctorId,
  defaultDoctorId,
  voice = false,
  voiceText,
}: {
  open: boolean;
  onClose: () => void;
  tz: string;
  defaultDateISO: string;
  doctors: Array<{ id: string; name: string }>;
  lockedDoctorId?: string;
  defaultDoctorId?: string;
  /** Start listening as the sheet opens (home "book…" voice command / voice FAB). */
  voice?: boolean;
  /** Pre-transcribed command handed off from the home voice hero (?q=). */
  voiceText?: string;
}) {
  const toast = useToast();
  const create = useCreateAppointment();
  const recurring = useCreateRecurring();

  const [search, setSearch] = useState('');
  const [patient, setPatient] = useState<PatientListItem | null>(null);
  const [doctorId, setDoctorId] = useState<string>(lockedDoctorId ?? defaultDoctorId ?? doctors[0]?.id ?? '');

  // Re-sync the doctor when the sheet (re)opens with a different prefilled doctor (multi-doctor tap).
  const firstDoctorId = doctors[0]?.id ?? '';
  useEffect(() => {
    if (open) setDoctorId(lockedDoctorId ?? defaultDoctorId ?? firstDoctorId);
  }, [open, defaultDoctorId, lockedDoctorId, firstDoctorId]);
  const [dateISO, setDateISO] = useState(defaultDateISO);
  const [duration, setDuration] = useState(30);
  const [procedureHint, setProcedureHint] = useState('');
  const [startsAt, setStartsAt] = useState<Date | null>(null);
  const [isRecurring, setIsRecurring] = useState(false);
  const [occurrences, setOccurrences] = useState(4);
  const [interval, setInterval] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('WEEKLY');
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [acked, setAcked] = useState(false);
  const [busy, setBusy] = useState(false);

  const patients = usePatients(search, 'all');
  const list = patients.data?.pages.flatMap((p) => p.items) ?? [];
  const slots = useSlots(dateISO, doctorId, duration, open && !!doctorId);

  // ── Voice booking (Phase 9.7 W1.2.5) — the sheet itself is the verification card. ──
  const localDateOf = (d: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

  function applyDictation(data: ApptDictateResponse) {
    const x = data.extraction;
    if (data.patientMatches.length === 1) {
      setPatient(data.patientMatches[0] as unknown as PatientListItem);
    } else if (x.patientName) {
      setSearch(x.patientName); // ambiguous → the search list becomes the picker
    }
    if (!lockedDoctorId && data.doctorMatches[0]) setDoctorId(data.doctorMatches[0].id);
    if (data.suggestedDateTime) {
      const at = new Date(data.suggestedDateTime);
      setDateISO(localDateOf(at));
      setStartsAt(data.dateHasTime ? at : null); // date-only phrases still need a slot pick
    }
    setDuration(data.durationMinutes);
    if (x.procedureHint) setProcedureHint(x.procedureHint.replace(/\b\w/g, (c) => c.toUpperCase()));
    if (x.isRecurring) {
      setIsRecurring(true);
      if (x.recurringInterval) setInterval(x.recurringInterval);
      if (x.recurringCount) setOccurrences(Math.max(2, Math.min(12, x.recurringCount)));
    }
    if (data.conflicts?.length) setConflicts(data.conflicts); // Phase 6 check ran server-side
    toast.info('Filled from your voice — review and book.');
  }

  // Home hero hand-off: extract from the already-transcribed command, no second recording.
  const textHandled = useRef(false);
  useEffect(() => {
    if (!open) {
      textHandled.current = false;
      return;
    }
    if (voiceText && !textHandled.current) {
      textHandled.current = true;
      api
        .post<ApptDictateResponse>('/appointments/dictate', { text: voiceText })
        .then(applyDictation)
        .catch(() => toast.error('Could not understand the command — book manually.'));
    }
  }, [open, voiceText]); // applyDictation intentionally not a dep — runs once per open
  const banner = useMemo(() => deriveConflictBanner(conflicts, acked ? conflicts.filter((c) => c.kind === 'SOFT').map((c) => c.code) : []), [conflicts, acked]);
  const preview = isRecurring && startsAt ? previewSeries({ firstDateISO: dateISO, interval, totalOccurrences: occurrences }) : [];

  function reset() {
    setSearch(''); setPatient(null); setStartsAt(null); setProcedureHint('');
    setIsRecurring(false); setConflicts([]); setAcked(false);
  }
  function close() { reset(); onClose(); }

  async function submit() {
    if (!patient || !doctorId || !startsAt) return;
    setBusy(true);
    const ackCodes = conflicts.filter((c) => c.kind === 'SOFT').map((c) => c.code);
    try {
      if (isRecurring) {
        await recurring.mutateAsync({
          patientId: patient.id, doctorId, firstStartsAt: startsAt, durationMinutes: duration,
          totalOccurrences: occurrences, interval, procedureHint: procedureHint || undefined,
          acknowledgedSoftConflicts: acked ? ackCodes : undefined,
        });
        toast.success(`Scheduled ${occurrences} appointments`);
      } else {
        await create.mutateAsync({
          patientId: patient.id, doctorId, startsAt, durationMinutes: duration,
          procedureHint: procedureHint || undefined,
          acknowledgedSoftConflicts: acked ? ackCodes : undefined,
        });
        toast.success('Appointment booked');
      }
      close();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'CONFLICTS') {
        const found = (e.details as { conflicts?: Conflict[] })?.conflicts ?? [];
        setConflicts(found);
        setAcked(false);
        if (found.some((c) => c.kind === 'HARD')) toast.error('Cannot book — there’s a conflict');
      } else if (e instanceof ApiError && e.code === 'SERIES_UNSCHEDULED') {
        toast.error('Some occurrences could not be scheduled — adjust the interval');
      } else {
        toast.error(e instanceof ApiError ? e.message : 'Could not book');
      }
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = !!patient && !!doctorId && !!startsAt && banner.canSubmit && !busy;

  return (
    <BottomSheet open={open} onClose={close} title="New appointment">
      <div className="flex flex-col gap-4">
        {/* Voice booking — fills the form below; the form is the review surface. */}
        <VoiceInput<ApptDictateResponse>
          mode="extraction"
          endpoint="/appointments/dictate"
          placement="sheet"
          label="Speak the booking"
          hint="“Book cleaning for Ramesh next Monday 10am”"
          autoStart={open && voice && !voiceText}
          onExtraction={applyDictation}
        />

        {/* Patient */}
        {patient ? (
          <button type="button" onClick={() => setPatient(null)} className="flex items-center justify-between rounded-xl border border-border bg-paper-warm px-3 py-2 text-left">
            <span className="text-sm font-medium">{patient.name} · {patient.age}</span>
            <span className="text-xs text-lime">Change</span>
          </button>
        ) : (
          <div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-subtle" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patient" className="pl-9" />
            </div>
            {search ? (
              <div className="mt-2 max-h-40 overflow-y-auto rounded-xl border border-border">
                {list.map((p) => (
                  <button key={p.id} type="button" onClick={() => setPatient(p)} className="block w-full border-b border-border px-3 py-2 text-left text-sm last:border-0 hover:bg-muted">
                    {p.name} · {p.age}
                  </button>
                ))}
                {list.length === 0 ? <p className="px-3 py-2 text-xs text-text-subtle">No matches</p> : null}
              </div>
            ) : null}
          </div>
        )}

        {/* Doctor (radio when multi-doctor + not locked) */}
        {!lockedDoctorId && doctors.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {doctors.map((d) => (
              <button key={d.id} type="button" onClick={() => { setDoctorId(d.id); setStartsAt(null); }}
                className={cn('rounded-pill border px-3 py-1.5 text-xs font-medium', doctorId === d.id ? 'border-lime bg-lime text-ink' : 'border-border bg-paper-warm')}>
                {d.name}
              </button>
            ))}
          </div>
        ) : null}

        {/* Date */}
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-text-subtle">Date</span>
          <Input type="date" value={dateISO} onChange={(e) => { setDateISO(e.target.value); setStartsAt(null); }} />
        </label>

        {/* Duration chips */}
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((d) => (
            <button key={d} type="button" onClick={() => { setDuration(d); setStartsAt(null); }}
              className={cn('rounded-pill border px-3 py-1.5 text-xs font-medium', duration === d ? 'border-lime bg-lime text-ink' : 'border-border bg-paper-warm')}>
              {d}m
            </button>
          ))}
        </div>

        {/* Slot picker */}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wide text-text-subtle">Available slots · {fmtDate(dateISO)}</span>
          <SlotPicker slots={slots.data?.slots ?? []} tz={tz} loading={slots.isLoading} selectedISO={startsAt?.toISOString() ?? null} onPick={(s) => { setStartsAt(s); setConflicts([]); }} />
        </div>

        {/* Procedure hint */}
        <Input value={procedureHint} onChange={(e) => setProcedureHint(e.target.value)} placeholder="Procedure (e.g. Cleaning, RCT)" />

        {/* Recurring */}
        <label className="flex items-center justify-between">
          <span className="text-sm font-medium">Repeat (multi-sitting)</span>
          <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="size-4 accent-lime" />
        </label>
        {isRecurring ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-paper-warm p-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-subtle">Sittings</span>
              <input type="number" min={2} max={12} value={occurrences} onChange={(e) => setOccurrences(Math.max(2, Math.min(12, Number(e.target.value))))} className="w-16 rounded-md border border-border px-2 py-1 text-sm" />
              {(['WEEKLY', 'BIWEEKLY', 'MONTHLY'] as const).map((iv) => (
                <button key={iv} type="button" onClick={() => setInterval(iv)} className={cn('rounded-pill border px-2.5 py-1 text-[11px]', interval === iv ? 'border-lime bg-lime text-ink' : 'border-border')}>
                  {iv === 'WEEKLY' ? 'Weekly' : iv === 'BIWEEKLY' ? '2-weekly' : 'Monthly'}
                </button>
              ))}
            </div>
            {preview.length > 0 ? (
              <ul className="text-[11px] text-text-subtle">
                {preview.map((r) => (
                  <li key={r.index}>Sitting {r.index} — {fmtDate(r.dateISO)}{startsAt ? ` · ${formatLocalTime(startsAt, tz)}` : ''}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* Conflict banner */}
        {banner.severity !== 'none' ? (
          <div className={cn('flex flex-col gap-2 rounded-xl border p-3 text-sm', banner.severity === 'hard' ? 'border-destructive bg-destructive/10 text-destructive' : 'border-warning bg-warning-soft text-ink')}>
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="size-4" />
              {banner.severity === 'hard' ? 'Cannot book' : 'Please confirm'}
            </div>
            {[...banner.hard, ...banner.soft].map((c) => <p key={c.code} className="text-xs">{c.message}</p>)}
            {banner.severity === 'soft' ? (
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={acked} onChange={(e) => setAcked(e.target.checked)} className="size-4 accent-lime" />
                I acknowledge this conflict
              </label>
            ) : null}
          </div>
        ) : null}

        <Button onClick={submit} disabled={!canSubmit} loading={busy}>
          <Check className="size-4" /> {isRecurring ? `Schedule ${occurrences}` : 'Book appointment'}
        </Button>
      </div>
    </BottomSheet>
  );
}
