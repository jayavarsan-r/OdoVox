'use client';

import { useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import type { ConsultationContext } from '@odovox/types';
import { MascotMoment } from '@/components/illustrations/mascot-moment';
import { Button } from '@/components/ui/button';
import { Chip, Mini } from '@/components/ui/badge';
import { InitialsAvatar } from '@/components/ui/avatar';
import { Recorder } from '@/components/voice/recorder';
import { ProgressStrip } from '@/components/voice/progress-strip';
import { VerificationCard } from '@/components/voice/verification-card';
import { PatientContextCard } from '@/components/consult/patient-context-card';
import { ComplaintStrip } from '@/components/consult/complaint-strip';
import { useConsultStore } from '@/lib/consult/store';
import { failureMessage } from '@/lib/consult/failure-copy';
import { NextUpHint } from '@/components/queue/next-up-hint';
import { SavedScreen } from '@/components/voice/verification/saved-screen';
import { useQueueStore } from '@/lib/queue/store';
import { getWaiting } from '@/lib/queue/selectors';
import { nextSittingLine, savedOutcomes } from '@/lib/consult/card-view';
import { api } from '@/lib/api-client';
import { cn, fmtDuration } from '@/lib/utils';

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
  // Phase 9.6 Issue 13: the confirm wrote plans/sittings/visits — the 30s staleTime would
  // otherwise show the doctor a pre-confirm Overview ("0 of 4 sittings"). Invalidate everything
  // the patient page reads, plus the queue snapshot the front desk watches.
  const queryClient = useQueryClient();
  useEffect(() => {
    if (state.kind === 'CONFIRMED') {
      if (patientId) {
        for (const key of [
          ['patient', patientId],
          ['plans', patientId],
          ['completed-procedures', patientId],
          ['visits', patientId],
          ['teeth', patientId],
        ]) {
          void queryClient.invalidateQueries({ queryKey: key });
        }
      }
      void queryClient.invalidateQueries({ queryKey: ['queue'] });
      const t = setTimeout(() => router.replace(patientId ? `/patients/${patientId}` : '/consult'), 1800);
      return () => clearTimeout(t);
    }
    if (state.kind === 'REJECTED') {
      const t = setTimeout(() => router.replace('/consult'), 600);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [state.kind, patientId, router, queryClient]);

  const isRecorder = ['IDLE', 'REQUESTING_PERMISSION', 'RECORDING', 'PAUSED', 'STOPPED'].includes(state.kind);
  const isPipeline = ['UPLOADING', 'TRANSCRIBING', 'TRANSCRIBED', 'EXTRACTING'].includes(state.kind);
  const isVerify = state.kind === 'VERIFY' || state.kind === 'CONFIRMING';
  const recording = state.kind === 'RECORDING' || state.kind === 'PAUSED';
  // Frames 23-25 all keep the patient strip: the doctor must be able to see whose
  // recording is on screen, and that need does not end when the audio stops.
  const failed = state.kind === 'FAILED';
  const showsPatientStrip = recording || isPipeline || failed;
  const capturedMs = useConsultStore((s) => s.capturedMs);

  // Frame 31 reports what the doctor's words CAUSED — an Rx, a bill, a booking — but by
  // the time CONFIRMED renders, the extraction that produced them is gone from the state
  // machine. So the summary is snapshotted on the last frame that still has the data.
  // A ref, not state: writing it must not re-render the card mid-confirm.
  const confirmedRef = useRef<{
    firstName: string;
    outcomes: ReturnType<typeof savedOutcomes>;
  } | null>(null);
  if (state.kind === 'VERIFY' || state.kind === 'CONFIRMING') {
    confirmedRef.current = {
      firstName: (context?.patient.name ?? '').split(/\s+/)[0] ?? '',
      outcomes: savedOutcomes(state.data, new Date()),
    };
  }
  const confirmed = confirmedRef.current;

  // Frame 31's primary action is the next patient — the doctor's actual next move after
  // filing a record. Read from the live queue, so an empty waiting room shows no button
  // rather than a dead one.
  const queue = useQueueStore((s) => s.state);
  const myDoctorId = useQueueStore((s) => s.myDoctorId) ?? undefined;
  const nextWaiting = getWaiting(queue, myDoctorId)[0];

  return (
    <div className={cn('relative flex min-h-dvh flex-col bg-paper', recording && 'bg-paper-warm')}>
      {/* Frames 23-26 replace the generic "Consultation" header with a patient strip: a
          38px avatar, the name at 15px/800, and a status line under it. The frame puts
          identity on the screen where the recording happens — that is the safety point,
          not decoration. It shifts by state, and the frames are specific about how:

            recording   live-ringed avatar · age + allergy Minis · REC chip opposite
            processing  quiet avatar · "04:32 audio" under the name · nothing opposite
            failed      the same, plus "· saved" — the screen's entire reassurance

          Off these states the ordinary header returns. */}
      {isVerify || state.kind === 'CONFIRMED' ? null : showsPatientStrip && context ? (
        <header className="flex items-center gap-2.5 px-gutter pt-2">
          <InitialsAvatar
            name={context.patient.name}
            /* The live ring means audio is being captured RIGHT NOW. Paused keeps the
               strip but drops the ring — frame 24 is emphatic that a paused recorder must
               not look like a running one. */
            ring={state.kind === 'RECORDING' ? 'live' : 'none'}
            size="sm"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-heavy text-pine">
              {context.patient.name}
            </p>
            <span className="mt-[3px] flex flex-wrap items-center gap-1.5">
              {isPipeline || failed ? (
                /* How much audio is in flight — never which pipeline stage is running
                   (#43). Once the audio stops, age and allergies have nothing to add to
                   a wait, so the frame drops them for the one fact that matters. */
                <Mini tone="neutral">
                  {fmtDuration(capturedMs)} audio{failed ? ' · saved' : ''}
                </Mini>
              ) : (
                <>
                  <Mini tone="neutral">{context.patient.age}</Mini>
                  {[...context.patient.allergies, ...context.patient.medicalFlags].map((f) => (
                    <Mini key={f} tone="crit">
                      {f}
                    </Mini>
                  ))}
                </>
              )}
            </span>
          </div>
          {recording ? (
            <Chip tone={state.kind === 'PAUSED' ? 'warn' : 'live'}>
              {state.kind === 'PAUSED' ? 'PAUSED' : 'REC'}
            </Chip>
          ) : null}
        </header>
      ) : (
        /* Frames 27-31 have no chrome above "Review" — the card's own header is the top of
           the screen, and a second title bar would push the whole record down a line for
           nothing. */
        <header className="flex items-center gap-2 px-4 pt-4">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="text-text-muted">
            <ChevronLeft className="size-6" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">Consultation</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-medium text-text-subtle">
            <span className="size-2 rounded-pill bg-lime" /> LIVE
          </span>
        </header>
      )}

      {/* Frame 24 puts the pause reason in an amber banner directly under the strip, not
          in a chip down by the controls — a paused recorder is a state the doctor must
          notice from across the room, and the frame treats it as a warning rather than a
          caption. The copy is honest about WHY: v9's frame reads "Paused automatically for
          a phone call", but nothing auto-pauses on interruption yet (deviation #49), and a
          screen that claims the phone rang when the doctor pressed Pause is worse than a
          screen that says less. */}
      {state.kind === 'PAUSED' ? (
        <div className="mx-gutter mt-2.5 rounded-lg bg-warn-soft px-3.5 py-2.5">
          <p className="text-[12.5px] font-heavy leading-[1.45] text-warn">
            Paused · audio safe on this phone
          </p>
        </div>
      ) : null}

      {/* Full patient context on the idle/ready states only.
          On VERIFY it is deliberately absent: frame 27's own header carries the identity
          line ("Anand Kumar › RCT 36 · Sitting 2"), so keeping the context card here too
          would print the patient's name twice on one screen — the exact duplication
          Phase 4.5 Issue 5 exists to prevent. The identity is still on the verification
          surface, and still from the patient DB record rather than the extraction. */}
      {context && isRecorder && !recording ? (
        <div className="px-5 pt-3">
          <PatientContextCard ctx={context} />
        </div>
      ) : null}

      {/* The verification surface owns its own gutters — its bento, medicine card and
          prose rule each sit at different insets — so main contributes none on VERIFY. */}
      <main
        className={cn(
          'flex flex-1 flex-col',
          isVerify ? 'min-h-0 pt-3' : 'items-center justify-center px-5 py-8',
        )}
      >
        {isRecorder ? (
          <Recorder complaint={context && recording ? <ComplaintStrip ctx={context} /> : undefined} />
        ) : null}

        {/* Verification card — the main working surface (Phase 9.6 Issue 6): full-page and
            in-flow, not a sheet over a dimmed recorder. All fields edit inline; every edit
            autosaves; Save runs through the Preview step. */}
        {isVerify ? (
          <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            className="flex min-h-0 w-full flex-1 flex-col"
          >
            <VerificationCard
              data={state.data}
              safety={state.safety}
              /* Identity from the patient DB record, never from the extraction. */
              patientName={context?.patient.name ?? ''}
              nextSittingLine={nextSittingLine(state.data, new Date())}
              onOpenPatient={() => patientId && router.push(`/patients/${patientId}`)}
            />
          </motion.div>
        ) : null}

        {isPipeline ? (
          <div className="flex w-full max-w-mobile flex-1 flex-col px-gutter">
            <div className="flex flex-1 items-center justify-center">
              <ProgressStrip />
            </div>
            {/* Cancel sits at the bottom edge in frame 25 — deliberately far from the
                waiting doctor's thumb, so it is chosen rather than brushed. */}
            <button
              type="button"
              onClick={() => useConsultStore.getState().dispatch({ type: 'RERECORD' })}
              className="w-full pb-2 text-center text-[13px] font-heavy text-pine-2"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {/* Frame 26 — failure. Its note is the whole design: "Failure never loses audio."

            The old screen offered ONE action, "Re-record", which nulls the blob and makes
            the doctor dictate four minutes again. But the recording is still on the
            device — `refs.blob` survives a FAILED state — so the frame's "Try again" is a
            RETRY OF THE UPLOAD, not a re-record. `sendForReview()` re-presigns, re-PUTs
            and re-opens the stream, so calling it again is exactly that. Re-record stays
            available underneath, because sometimes the audio really is the problem. */}
        {state.kind === 'FAILED' ? (
          <div className="flex w-full max-w-mobile flex-col items-center gap-3 px-gutter text-center">
            {/* A different face from the processing screen — same pose read as "still
                working" at a glance. */}
            <MascotMoment pose="concerned" size="lg" animation="none" />
            <p className="text-[19px] font-heavy tracking-tight text-pine">
              Couldn&apos;t process
            </p>
            {/* `state.error` is the raw exception; it stays in state for logs and never
                reaches the doctor (#43). `state.step` — "upload", "transcription" — was
                rendered here in a chip and is a pipeline stage by definition, so it is
                gone entirely. What survives is the only line that changes what the doctor
                does: the audio is still on the phone. */}
            <p className="text-[12.5px] font-semibold leading-[1.5] text-pine-2">
              {failureMessage(state.error)}
              <br />
              Your recording is safe on this phone.
            </p>
            <div className="mt-2 flex w-full flex-col gap-2.5">
              <Button
                block
                onClick={() => void useConsultStore.getState().sendForReview()}
              >
                Try again
              </Button>
              <Button
                variant="outline"
                block
                onClick={() => useConsultStore.getState().dispatch({ type: 'RERECORD' })}
              >
                Record again instead
              </Button>
            </div>
          </div>
        ) : null}

        {state.kind === 'CONFIRMED' && confirmed ? (
          <SavedScreen
            patientFirstName={confirmed.firstName}
            outcomes={confirmed.outcomes}
            nextPatientName={nextWaiting?.patient.name ?? null}
            onCallNext={() => router.replace('/consult')}
            onBackToFlow={() => router.replace('/home')}
          />
        ) : null}
      </main>

      {/* Next-up hint (§6.3) — only while recording/processing, never over the verification card. */}
      {isRecorder || isPipeline ? <NextUpHint /> : null}
    </div>
  );
}
