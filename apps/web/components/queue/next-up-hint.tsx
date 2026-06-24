'use client';

import { useQueueStore } from '@/lib/queue/store';
import { getWaiting } from '@/lib/queue/selectors';

/** Unobtrusive "Next up" footer on the consult page — situational awareness, no action (§6.3). */
export function NextUpHint() {
  const state = useQueueStore((s) => s.state);
  const myDoctorId = useQueueStore((s) => s.myDoctorId) ?? undefined;
  const next = getWaiting(state, myDoctorId)[0];
  if (!next) return null;
  return (
    <p className="px-5 pb-4 text-center text-xs text-text-subtle">
      Next up: <span className="font-medium text-text-muted">{next.patient.name}</span>
      {next.chiefComplaint ? ` · ${next.chiefComplaint}` : ''}
    </p>
  );
}
