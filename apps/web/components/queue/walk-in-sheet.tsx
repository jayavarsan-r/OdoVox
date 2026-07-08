'use client';

import { useState } from 'react';
import { FileText, ImagePlus, Search, Sparkles, X } from 'lucide-react';
import type { PatientListItem } from '@odovox/types';
import { CreatePatientInput } from '@odovox/types';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InitialsAvatar } from './queue-cards';
import { usePatients, useCreatePatient } from '@/lib/queries';
import { useWalkIn, uploadVisitXray, XRAY_ACCEPT } from '@/lib/queue/mutations';
import { useQueueStore } from '@/lib/queue/store';
import { waitingCountByDoctor } from '@/lib/queue/selectors';
import { buildWalkInBody, defaultDoctorId, doctorChoices } from '@/lib/queue/walk-in';
import { VoiceInput } from '@/components/voice/voice-input';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** What /queue/walkin/dictate returns under data.intake (PatientIntakeExtraction). */
interface WalkInIntake {
  name: string | null;
  phone: string | null;
  age: number | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | null;
  chiefComplaint: string | null;
}

const GENDERS = [
  { label: 'M', value: 'MALE' },
  { label: 'F', value: 'FEMALE' },
  { label: 'Other', value: 'OTHER' },
] as const;

type Step = 'type' | 'patient' | 'newPatient' | 'doctor';

const STEP_TITLE: Record<Step, string> = {
  type: 'Voice walk-in',
  patient: 'Add walk-in',
  newPatient: 'New patient',
  doctor: 'Assign to doctor',
};

/**
 * Receptionist walk-in (redesigned for Phase 9.6 Issue 4): with `voice` the sheet opens on a
 * type picker — Existing patient (voice-search) or New patient (voice-add the details) — then
 * always funnels into the doctor step, so every path ends with a WAITING visit in the queue.
 */
export function WalkInSheet({ open, voice = false, onClose }: { open: boolean; voice?: boolean; onClose: () => void }) {
  const toast = useToast();
  const state = useQueueStore((s) => s.state);
  const walkIn = useWalkIn();
  const createPatient = useCreatePatient();

  const [step, setStep] = useState<Step | null>(null);
  const [voiceSearch, setVoiceSearch] = useState(false);
  const [search, setSearch] = useState('');
  const [patient, setPatient] = useState<{ id: string; name: string } | null>(null);
  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [complaint, setComplaint] = useState('');
  const [priority, setPriority] = useState(0);
  const [xrayFiles, setXrayFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);

  // New-patient mini-form (the voice verification surface — dictation prefills, reception edits).
  const [npName, setNpName] = useState('');
  const [npPhone, setNpPhone] = useState('');
  const [npAge, setNpAge] = useState('');
  const [npGender, setNpGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | null>(null);

  // The voice FAB path starts on the type picker; the plain "Add walk-in" path keeps the old
  // search-first behavior.
  const activeStep: Step = step ?? (voice ? 'type' : 'patient');

  const patients = usePatients(search, 'all');
  const list = patients.data?.pages.flatMap((p) => p.items) ?? [];
  const choices = doctorChoices(state.doctors, waitingCountByDoctor(state));

  const npValid = CreatePatientInput.safeParse({
    name: npName.trim(),
    phone: npPhone.trim(),
    age: Number(npAge),
    gender: npGender,
  }).success;

  function reset() {
    setStep(null);
    setVoiceSearch(false);
    setSearch('');
    setPatient(null);
    setDoctorId(null);
    setComplaint('');
    setPriority(0);
    setXrayFiles([]);
    setBusy(false);
    setNpName('');
    setNpPhone('');
    setNpAge('');
    setNpGender(null);
  }
  function close() {
    reset();
    onClose();
  }
  function pickPatient(p: PatientListItem) {
    setPatient({ id: p.id, name: p.name });
    setDoctorId(defaultDoctorId(state.doctors));
    setStep('doctor');
  }
  function addXrays(files: FileList | null) {
    if (!files) return;
    setXrayFiles((prev) => [...prev, ...Array.from(files)].slice(0, 6));
  }

  async function createAndContinue() {
    if (!npValid) return;
    setBusy(true);
    try {
      const created = await createPatient.mutateAsync({
        name: npName.trim(),
        phone: npPhone.trim(),
        age: Number(npAge),
        gender: npGender!,
        ...(complaint.trim() ? { chiefComplaint: complaint.trim() } : {}),
        medicalFlags: [],
      });
      toast.success(`${created.name} created`);
      setPatient({ id: created.id, name: created.name });
      setDoctorId(defaultDoctorId(state.doctors));
      setBusy(false);
      setStep('doctor');
    } catch (e) {
      setBusy(false);
      toast.error(e instanceof ApiError ? e.message : 'Could not create the patient');
    }
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
    <BottomSheet open={open} onClose={close} title={STEP_TITLE[activeStep]}>
      {activeStep === 'type' ? (
        // ── Step 1 — pick the walk-in type (Issue 4) ─────────────────────────────
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => {
              setVoiceSearch(true);
              setStep('patient');
            }}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-paper-warm p-4 text-left active:scale-[0.99]"
          >
            <span className="flex size-10 items-center justify-center rounded-md bg-sky-soft text-ink">
              <Search className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">Existing patient</span>
              <span className="block text-xs text-text-muted">Voice-search by name or phone</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setStep('newPatient')}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-paper-warm p-4 text-left active:scale-[0.99]"
          >
            <span className="flex size-10 items-center justify-center rounded-md bg-lime-soft text-ink">
              <Sparkles className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">New patient</span>
              <span className="block text-xs text-text-muted">Voice-add patient details</span>
            </span>
          </button>
        </div>
      ) : activeStep === 'patient' ? (
        // ── Step 2A — existing patient: voice-search → pick ─────────────────────
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Search by name or phone"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="flex-1"
            />
            {/* Voice search: dictate "Ramesh" or a phone number — the name drives the search,
                a spoken complaint prefills the visit details. */}
            <VoiceInput<{ intake: WalkInIntake; transcript: string }>
              mode="extraction"
              endpoint="/queue/walkin/dictate"
              size="md"
              label="Voice search"
              hint="name · phone"
              showStatus
              autoStart={open && voiceSearch}
              onExtraction={({ intake, transcript }) => {
                setSearch(intake.name ?? intake.phone ?? transcript.trim());
                if (intake.chiefComplaint) setComplaint(intake.chiefComplaint);
                toast.info('Filled from your voice — pick the patient to continue.');
              }}
            />
          </div>
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
          <Button variant="ghost" onClick={() => setStep('newPatient')}>
            New patient
          </Button>
        </div>
      ) : activeStep === 'newPatient' ? (
        // ── Step 2B — new patient: voice-add → verify the 4 fields → create ─────
        <div className="space-y-3">
          <VoiceInput<{ intake: WalkInIntake; transcript: string }>
            mode="extraction"
            endpoint="/queue/walkin/dictate"
            placement="sheet"
            label="Speak patient details"
            hint="Name · phone · age · complaint"
            autoStart={open && voice && step === 'newPatient'}
            onExtraction={({ intake }) => {
              if (intake.name) setNpName(intake.name);
              if (intake.phone) setNpPhone(intake.phone);
              if (intake.age) setNpAge(String(intake.age));
              if (intake.gender) setNpGender(intake.gender);
              if (intake.chiefComplaint) setComplaint(intake.chiefComplaint);
              toast.info('Filled from your voice — verify before creating.');
            }}
          />
          <Input placeholder="Full name" value={npName} onChange={(e) => setNpName(e.target.value)} />
          <div className="flex gap-2">
            <Input
              placeholder="Phone (10 digits)"
              inputMode="tel"
              value={npPhone}
              onChange={(e) => setNpPhone(e.target.value)}
              className="flex-1"
            />
            <Input
              placeholder="Age"
              type="number"
              inputMode="numeric"
              value={npAge}
              onChange={(e) => setNpAge(e.target.value)}
              className="w-20"
            />
          </div>
          <div className="flex gap-2">
            {GENDERS.map((g) => (
              <button
                key={g.value}
                type="button"
                onClick={() => setNpGender(g.value)}
                className={cn(
                  'flex-1 rounded-md border py-2.5 text-sm font-medium transition-colors',
                  npGender === g.value ? 'border-ink bg-ink text-paper' : 'border-border bg-surface',
                )}
              >
                {g.label}
              </button>
            ))}
          </div>
          <Input
            placeholder="Chief complaint (optional)"
            value={complaint}
            onChange={(e) => setComplaint(e.target.value)}
          />
          <Button className="w-full" disabled={!npValid} loading={busy} onClick={createAndContinue}>
            Create &amp; assign doctor
          </Button>
        </div>
      ) : (
        // ── Step 3 — visit details: doctor · complaint · priority · x-rays ──────
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
