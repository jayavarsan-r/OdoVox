'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import type { ConsultationContext } from '@odovox/types';
import { GlassCard } from '@/components/ds';
import { complaintText, genderLabel, hasComplaint } from '@/lib/consult/context-view';
import { XrayStrip } from './xray-strip';
import { cn } from '@/lib/utils';

function initials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
}

function useInChairTimer(since: Date | string | null): string | null {
  const [, force] = useState(0);
  useEffect(() => {
    if (!since) return;
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [since]);
  if (!since) return null;
  const secs = Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000));
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

/**
 * Rich patient context for the consultation IDLE state (Phase 4.5, Issues 2+3+4). Glass surface
 * (modal context, §12.1-allowed). Allergies stand out in danger; medical flags in warning; the
 * chief complaint reception checked the patient in for is prominent; x-rays attached at check-in
 * show as a strip. bg-paper page, no mascot, no gradient mesh.
 */
export function PatientContextCard({ ctx }: { ctx: ConsultationContext }) {
  const router = useRouter();
  const { patient, visit, xrays } = ctx;
  const timer = useInChairTimer(visit.calledInAt);
  const ringActive = visit.status === 'IN_CHAIR';

  return (
    <GlassCard tone="light" border="soft">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-14 shrink-0 items-center justify-center rounded-pill bg-ink text-lg font-semibold text-paper ring-2 ring-offset-2 ring-offset-paper',
            ringActive ? 'ring-lime' : 'ring-sage',
          )}
        >
          {initials(patient.name)}
        </span>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => router.push(`/patients/${patient.id}`)}
            className="flex items-center gap-1 text-left text-2xl font-semibold text-ink"
          >
            <span className="truncate">{patient.name}</span>
            <ChevronRight className="size-4 shrink-0 text-text-subtle" />
          </button>
          <p className="text-sm text-text-muted">
            {patient.age} · {genderLabel(patient.gender)} ·{' '}
            <span className="font-mono tabular-nums">{patient.patientCode}</span> ·{' '}
            <span className="font-medium text-sage-deep">Token {visit.tokenNumber}</span>
          </p>
          {timer ? (
            <p className="mt-0.5 text-xs font-medium uppercase tracking-wide text-text-muted">{timer} in chair</p>
          ) : null}
        </div>
      </div>

      <div className="my-6 border-t border-border" />

      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-text-subtle">Chief complaint</p>
        <p
          className={cn(
            'mt-1 text-[18px] leading-snug',
            hasComplaint(ctx) ? 'italic text-ink' : 'text-text-muted',
          )}
        >
          {hasComplaint(ctx) ? `“${complaintText(ctx)}”` : complaintText(ctx)}
        </p>
      </div>

      {patient.allergies.length > 0 || patient.medicalFlags.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3">
          {patient.allergies.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-danger">
                Allergies ({patient.allergies.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {patient.allergies.map((a) => (
                  <span key={a} className="rounded-pill bg-danger/10 px-2 py-0.5 text-[11px] font-medium text-danger">
                    {a}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {patient.medicalFlags.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-subtle">
                Medical ({patient.medicalFlags.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {patient.medicalFlags.map((f) => (
                  <span key={f} className="rounded-pill bg-warning-soft px-2 py-0.5 text-[11px] font-medium text-ink">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {xrays.length > 0 ? (
        <div className="mt-6">
          <XrayStrip xrays={xrays} />
        </div>
      ) : null}
    </GlassCard>
  );
}
