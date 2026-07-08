'use client';

import { useState } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InitialsAvatar } from './queue-cards';
import { useQueueStore } from '@/lib/queue/store';
import { waitingCountByDoctor } from '@/lib/queue/selectors';
import { useQueueSnapshot, useWalkIn } from '@/lib/queue/mutations';
import { buildWalkInBody, defaultDoctorId, doctorChoices } from '@/lib/queue/walk-in';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

/**
 * Phase 9.6 Issue 15: "patient created" must flow straight into "patient in queue". This sheet
 * pops right after creation — pick a doctor (+ priority), tap Add to queue, and the visit lands
 * in WAITING. Skip is always available for pre-registrations that aren't visiting today.
 */
export function AddToQueueSheet({
  open,
  patient,
  defaultComplaint,
  onDone,
}: {
  open: boolean;
  patient: { id: string; name: string } | null;
  defaultComplaint?: string | null;
  onDone: (addedToQueue: boolean) => void;
}) {
  const toast = useToast();
  const state = useQueueStore((s) => s.state);
  useQueueSnapshot('all'); // hydrates the doctor list even when the sheet opens outside /today
  const walkIn = useWalkIn();

  const [doctorId, setDoctorId] = useState<string | null>(null);
  const [priority, setPriority] = useState(0);
  const [complaint, setComplaint] = useState('');
  const [seededFor, setSeededFor] = useState<string | null>(null);

  // Seed defaults when a different patient opens the sheet.
  if (patient && seededFor !== patient.id) {
    setSeededFor(patient.id);
    setDoctorId(defaultDoctorId(state.doctors));
    setComplaint(defaultComplaint ?? '');
    setPriority(0);
  }

  const choices = doctorChoices(state.doctors, waitingCountByDoctor(state));

  async function submit() {
    if (!patient || !doctorId) return;
    try {
      await walkIn.mutateAsync(
        buildWalkInBody({ patientId: patient.id, doctorId, chiefComplaint: complaint, priority }),
      );
      toast.success(`${patient.name} added to the queue`);
      onDone(true);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not add to queue');
    }
  }

  if (!patient) return null;
  return (
    <BottomSheet open={open} onClose={() => onDone(false)} title="Add to queue now?">
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-sage-tint p-3">
          <InitialsAvatar name={patient.name} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-ink">{patient.name}</span>
            <span className="block text-xs text-sage-deep">Patient created ✓</span>
          </span>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-subtle">Assign to doctor</p>
          {choices.length === 0 ? (
            <p className="rounded-lg bg-paper-warm p-3 text-sm text-text-muted">No doctors available right now.</p>
          ) : (
            choices.map((c) => (
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
            ))
          )}
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

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => onDone(false)}>
            Skip, add later
          </Button>
          <Button className="flex-1" disabled={!doctorId} loading={walkIn.isPending} onClick={submit}>
            Add to queue
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
