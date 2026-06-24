'use client';

import { useState, type ReactNode } from 'react';
import type { VisitWithPatient } from '@odovox/types';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { useCancelVisit, usePriority, useReassign } from '@/lib/queue/mutations';
import { useQueueStore } from '@/lib/queue/store';
import { nextPriority, reassignTargets } from '@/lib/queue/reassign';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const CANCEL_REASONS = ['Patient left', 'Wrong patient', 'Emergency', 'Other'];

function ActionButton({ children, onClick, danger }: { children: ReactNode; onClick: () => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border border-border bg-paper-warm px-4 py-3 text-left text-sm font-medium',
        danger ? 'text-danger' : 'text-ink',
      )}
    >
      {children}
    </button>
  );
}

/** Long-press a waiting patient → reassign / bump / lower / cancel (receptionist only). */
export function QueueActionSheet({
  visit,
  open,
  onClose,
}: {
  visit: VisitWithPatient | null;
  open: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const state = useQueueStore((s) => s.state);
  const reassign = useReassign();
  const priority = usePriority();
  const cancel = useCancelVisit();
  const [mode, setMode] = useState<'menu' | 'reassign' | 'cancel'>('menu');

  function close() {
    setMode('menu');
    onClose();
  }
  async function run(p: Promise<unknown>, ok: string) {
    try {
      await p;
      toast.success(ok);
      close();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Action failed');
    }
  }

  if (!visit) return null;
  const targets = reassignTargets(state.doctors, visit);
  const title = mode === 'menu' ? visit.patient.name : mode === 'reassign' ? 'Reassign to…' : 'Cancel reason';

  return (
    <BottomSheet open={open} onClose={close} title={title}>
      {mode === 'menu' ? (
        <div className="space-y-2">
          <ActionButton onClick={() => setMode('reassign')}>Reassign to…</ActionButton>
          <ActionButton onClick={() => run(priority.mutateAsync({ id: visit.id, body: { priority: nextPriority(visit.priority, 'bump') } }), 'Moved up the queue')}>
            Bump priority
          </ActionButton>
          <ActionButton onClick={() => run(priority.mutateAsync({ id: visit.id, body: { priority: nextPriority(visit.priority, 'lower') } }), 'Moved down the queue')}>
            Lower priority
          </ActionButton>
          <ActionButton danger onClick={() => setMode('cancel')}>
            Cancel visit
          </ActionButton>
        </div>
      ) : mode === 'reassign' ? (
        <div className="space-y-2">
          {targets.map((d) => (
            <ActionButton key={d.id} onClick={() => run(reassign.mutateAsync({ id: visit.id, body: { doctorId: d.id } }), `Reassigned to ${d.name}`)}>
              {d.name}
            </ActionButton>
          ))}
          {targets.length === 0 ? <p className="py-6 text-center text-sm text-text-muted">No other doctors today.</p> : null}
        </div>
      ) : (
        <div className="space-y-2">
          {CANCEL_REASONS.map((r) => (
            <ActionButton key={r} danger onClick={() => run(cancel.mutateAsync({ id: visit.id, body: { reason: r } }), 'Visit cancelled')}>
              {r}
            </ActionButton>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}
