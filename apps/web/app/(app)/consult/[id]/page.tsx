'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import type { ConsultationContext } from '@odovox/types';
import { MascotMoment } from '@/components/illustrations/mascot-moment';
import { Button } from '@/components/ui/button';
import { Recorder } from '@/components/voice/recorder';
import { ProgressStrip } from '@/components/voice/progress-strip';
import { VerificationCard } from '@/components/voice/verification-card';
import { PatientContextCard } from '@/components/consult/patient-context-card';
import { ComplaintStrip } from '@/components/consult/complaint-strip';
import { useConsultStore } from '@/lib/consult/store';
import { NextUpHint } from '@/components/queue/next-up-hint';
import { api } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/** The headline flow: record → pipeline progress → verification card → confirm. bg-paper, no mascot
 * at page level (only inside the CONFIRMED success card), no gradient mesh, glass on the cards only. */
export default function ConsultDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const state = useConsultStore((s) => s.state);

  // Patient + visit (chief complaint) + x-ray context for this consultation (Phase 4.5).
  const { data: context } = useQuery({
    queryKey: ['consult-context', id],
    queryFn: () => api.get<{ context: ConsultationContext }>(`/consultations/${id}`).then((r) => r.context),
    enabled: !!id,
  });
  const patientId = context?.patient.id ?? null;

  useEffect(() => {
    void useConsultStore.getState().init(id);
    return () => useConsultStore.getState().teardown();
  }, [id]);

  // On CONFIRMED, celebrate briefly then return to the patient detail with fresh data.
  useEffect(() => {
    if (state.kind === 'CONFIRMED') {
      const t = setTimeout(() => router.replace(patientId ? `/patients/${patientId}` : '/consult'), 1800);
      return () => clearTimeout(t);
    }
    if (state.kind === 'REJECTED') {
      const t = setTimeout(() => router.replace('/consult'), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state.kind, patientId, router]);

  const isRecorder = ['IDLE', 'REQUESTING_PERMISSION', 'RECORDING', 'PAUSED', 'STOPPED'].includes(state.kind);
  const isPipeline = ['UPLOADING', 'TRANSCRIBING', 'TRANSCRIBED', 'EXTRACTING'].includes(state.kind);
  const isVerify = state.kind === 'VERIFY' || state.kind === 'CONFIRMING';
  const recording = state.kind === 'RECORDING' || state.kind === 'PAUSED';

  return (
    <div className={cn('relative flex min-h-dvh flex-col bg-paper', recording && 'bg-paper-warm')}>
      <header className="flex items-center gap-2 px-4 pt-4">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="text-text-muted">
          <ChevronLeft className="size-6" />
        </button>
        {/* Static title — the patient's name renders once, inside the context card (§4.1). */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">Consultation</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
          <span className="size-2 rounded-pill bg-lime" /> LIVE
        </span>
      </header>

      {/* Full patient context on the idle/ready states; a compact strip while recording (§2.2–2.3). */}
      {context && isRecorder && !recording ? (
        <div className="px-5 pt-3">
          <PatientContextCard ctx={context} />
        </div>
      ) : null}
      {context && recording ? (
        <div className="pt-3">
          <ComplaintStrip ctx={context} />
        </div>
      ) : null}

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-8">
        {isRecorder ? <Recorder /> : null}

        {isPipeline ? (
          <div className="w-full max-w-mobile">
            <ProgressStrip state={state} />
            <button
              type="button"
              onClick={() => useConsultStore.getState().dispatch({ type: 'RERECORD' })}
              className="mt-6 w-full text-center text-sm text-text-muted"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {state.kind === 'FAILED' ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="text-base font-medium text-danger">Couldn&apos;t finish ({state.step}).</p>
            <p className="max-w-xs text-sm text-text-muted">{state.error}</p>
            <Button onClick={() => useConsultStore.getState().dispatch({ type: 'RERECORD' })}>Re-record</Button>
          </div>
        ) : null}

        {state.kind === 'CONFIRMED' ? (
          <div className="flex flex-col items-center gap-3 rounded-3xl bg-paper-cream p-8 text-center">
            <MascotMoment pose="celebrate" size="md" animation="bounce-in" />
            <p className="text-lg font-semibold text-ink">Sent to the front desk</p>
            <p className="text-sm text-text-muted">The record is filed. Taking you back…</p>
          </div>
        ) : null}
      </main>

      {/* Next-up hint (§6.3) — only while recording/processing, never over the verification sheet. */}
      {isRecorder || isPipeline ? <NextUpHint /> : null}

      {/* Verification card — bottom sheet sliding up over a dimmed recorder. */}
      {isVerify ? (
        <motion.div
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 32 }}
          className="fixed inset-x-0 bottom-0 z-50"
        >
          <VerificationCard data={state.data} safety={state.safety} />
        </motion.div>
      ) : null}
    </div>
  );
}
