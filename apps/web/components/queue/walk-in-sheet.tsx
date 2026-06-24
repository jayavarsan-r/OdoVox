'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { PatientListItem } from '@odovox/types';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InitialsAvatar } from './queue-cards';
import { usePatients } from '@/lib/queries';
import { useWalkIn } from '@/lib/queue/mutations';
import { useQueueStore } from '@/lib/queue/store';
import { waitingCountByDoctor } from '@/lib/queue/selectors';
import { buildWalkInBody, defaultDoctorId, doctorChoices } from '@/lib/queue/walk-in';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/** Receptionist walk-in: pick a patient → assign a doctor (+ optional complaint/priority) → check in. */
export function WalkInSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  const patients = usePatients(search, 'all');
  const list = patients.data?.pages.flatMap((p) => p.items) ?? [];
  const choices = doctorChoices(state.doctors, waitingCountByDoctor(state));

  function reset() {
    setStep('patient');
    setSearch('');
    setPatient(null);
    setDoctorId(null);
    setComplaint('');
    setPriority(0);
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
  async function submit() {
    if (!patient || !doctorId) return;
    try {
      await walkIn.mutateAsync(
        buildWalkInBody({ patientId: patient.id, doctorId, chiefComplaint: complaint, priority }),
      );
      toast.success(`${patient.name} checked in`);
      close();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not check in');
    }
  }

  return (
    <BottomSheet open={open} onClose={close} title={step === 'patient' ? 'Add walk-in' : 'Assign to doctor'}>
      {step === 'patient' ? (
        <div className="space-y-3">
          <Input
            placeholder="Search by name or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
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
          <Button onClick={submit} loading={walkIn.isPending} disabled={!doctorId}>
            Check in
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
