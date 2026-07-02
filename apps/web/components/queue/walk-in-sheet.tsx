'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { FileText, ImagePlus, Mic, Square, X } from 'lucide-react';
import type { PatientListItem } from '@odovox/types';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InitialsAvatar } from './queue-cards';
import { usePatients } from '@/lib/queries';
import { useWalkIn, uploadVisitXray, XRAY_ACCEPT } from '@/lib/queue/mutations';
import { useQueueStore } from '@/lib/queue/store';
import { waitingCountByDoctor } from '@/lib/queue/selectors';
import { buildWalkInBody, defaultDoctorId, doctorChoices } from '@/lib/queue/walk-in';
import { useDictation } from '@/lib/voice/use-dictation';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** Receptionist walk-in: pick a patient → assign a doctor (+ optional complaint/priority) → check in.
 * With `voice`, dictation starts as the sheet opens (the "Voice walk-in" FAB path). */
export function WalkInSheet({ open, voice = false, onClose }: { open: boolean; voice?: boolean; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const state = useQueueStore((s) => s.state);
  const walkIn = useWalkIn();

  const [step, setStep] = useState<'patient' | 'doctor'>('patient');
  const [search, setSearch] = useState('');
  const [patient, setPatient] = useState<PatientListItem | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [complaint, setComplaint] = useState('');
  const [priority, setPriority] = useState(0);
  const [xrayFiles, setXrayFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  const patients = usePatients(search, 'all');
  const list = patients.data?.pages.flatMap((p) => p.items) ?? [];
  const choices = doctorChoices(state.doctors, waitingCountByDoctor(state));

  // Voice walk-in (Phase 9.5 P1.6): dictate "new patient Ramesh, 98765…, tooth pain" — the name
  // drives the patient search, the complaint prefills. Everything stays editable in the form.
  const dictation = useDictation<{
    intake: { name: string | null; phone: string | null; chiefComplaint: string | null };
    transcript: string;
  }>('/queue/walkin/dictate', ({ intake, transcript }) => {
    setSearch(intake.name ?? intake.phone ?? transcript.trim());
    if (intake.chiefComplaint) setComplaint(intake.chiefComplaint);
    toast.info('Filled from your voice — pick the patient to continue.');
  });

  // "Voice walk-in" FAB: begin listening the moment the sheet opens (once per open).
  const autoStarted = useRef(false);
  const startDictation = dictation.start;
  useEffect(() => {
    if (!open) {
      autoStarted.current = false;
      return;
    }
    if (voice && !autoStarted.current) {
      autoStarted.current = true;
      void startDictation();
    }
  }, [open, voice, startDictation]);

  function reset() {
    setStep('patient');
    setSearch('');
    setPatient(null);
    setDoctorId(null);
    setComplaint('');
    setPriority(0);
    setXrayFiles([]);
    setBusy(false);
  }
  function close() {
    reset();
    onClose();
  }
  function pickPatient(p: PatientListItem) {
    setPatient(p);
    setDoctorId(defaultDoctorId(state.doctors));
    setStep('doctor');
  }
  function addXrays(files: FileList | null) {
    if (!files) return;
    setXrayFiles((prev) => [...prev, ...Array.from(files)].slice(0, 6));
  }
  async function submit() {
    if (!patient || !doctorId) return;
    setBusy(true);
    try {
      // Create the visit first (we need its id), then link any x-rays to it.
      const visit = await walkIn.mutateAsync(
        buildWalkInBody({ patientId: patient.id, doctorId, chiefComplaint: complaint, priority }),
      );
      for (const file of xrayFiles) {
        await uploadVisitXray({ patientId: patient.id, visitId: visit.id, file });
      }
      toast.success(`${patient.name} checked in${xrayFiles.length ? ` · ${xrayFiles.length} x-ray(s)` : ''}`);
      close();
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof ApiError ? e.message : 'Could not check in');
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title={step === 'patient' ? 'Add walk-in' : 'Assign to doctor'}>
      {step === 'patient' ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="flex-1"
            />
            <button
              type="button"
              aria-label={dictation.state.kind === 'recording' ? 'Stop dictation' : 'Dictate walk-in'}
              onClick={() =>
                dictation.state.kind === 'recording' ? dictation.stop() : void dictation.start()
              }
              disabled={dictation.state.kind === 'processing'}
              className={cn(
                'flex size-10 shrink-0 items-center justify-center rounded-pill',
                dictation.state.kind === 'recording' ? 'bg-ink text-paper' : 'bg-lime-soft text-ink',
              )}
            >
              {dictation.state.kind === 'recording' ? (
                <Square className="size-4 fill-current" />
              ) : (
                <Mic className="size-5" />
              )}
            </button>
          </div>
          {dictation.state.kind === 'recording' ? (
            <p className="text-center text-xs text-text-muted">Listening… name · phone · complaint</p>
          ) : null}
          {dictation.state.kind === 'processing' ? (
            <p className="text-center text-xs text-text-muted">Making sense of it…</p>
          ) : null}
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {list.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPatient(p)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-paper-warm p-3 text-left"
              >
                <InitialsAvatar name={p.name} />
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{p.name}</span>
                  <span className="block truncate text-xs text-text-muted">
                    {p.age} · {p.phone}
                  </span>
                </span>
              </button>
            ))}
            {list.length === 0 ? (
              <p className="py-8 text-center text-sm text-text-muted">No patients found.</p>
            ) : null}
          </div>
          <Button
            variant="ghost"
            onClick={() => {
              close();
              router.push('/patients/new');
            }}
          >
            New patient
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg bg-paper-warm p-3">
            <InitialsAvatar name={patient?.name ?? ''} />
            <span className="font-medium text-ink">{patient?.name}</span>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-text-subtle">Assign to doctor</p>
            {choices.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={!c.available}
                onClick={() => setDoctorId(c.id)}
                className={cn(
                  'flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors',
                  doctorId === c.id ? 'border-lime bg-lime-soft' : 'border-border bg-paper-warm',
                  !c.available && 'opacity-50',
                )}
              >
                <span className="font-medium text-ink">
                  {c.name}
                  {!c.available ? ' · off today' : ''}
                </span>
                <span className="text-xs text-text-muted">{c.waiting} waiting</span>
              </button>
            ))}
          </div>
          <Input
            placeholder="Chief complaint (optional)"
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
          />

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-text-subtle">
              Attach x-rays (optional)
            </p>
            <div className="flex flex-wrap gap-2">
              {xrayFiles.map((f, i) => (
                <span
                  key={`${f.name}-${i}`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-paper-warm px-2 py-1.5 text-xs text-ink"
                >
                  <FileText className="size-3.5 text-text-muted" />
                  <span className="max-w-[120px] truncate">{f.name}</span>
                  <button type="button" aria-label="Remove" onClick={() => setXrayFiles((p) => p.filter((_, j) => j !== i))}>
                    <X className="size-3.5 text-text-subtle" />
                  </button>
                </span>
              ))}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-text-muted">
                <ImagePlus className="size-4" /> Upload x-ray
                <input type="file" accept={XRAY_ACCEPT} multiple className="hidden" onChange={(e) => addXrays(e.target.files)} />
              </label>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setPriority(priority === 10 ? 0 : 10)}
            className={cn(
              'rounded-pill px-3 py-1.5 text-sm font-medium transition-colors',
              priority === 10 ? 'bg-peach text-ink' : 'bg-paper-warm text-text-muted',
            )}
          >
            Priority patient
          </button>
          <Button onClick={submit} loading={busy} disabled={!doctorId}>
            Check in
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
