'use client';

import { useReducer } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Armchair } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EmptyState } from '@/components/ds';
import { staggerChildren } from '@/components/ds/motion';
import { Spinner } from '@/components/ui/spinner';
import { InChairCard, WaitingRow, CheckoutRow } from '@/components/queue/queue-cards';
import { OfflineBanner, RealtimeDot } from '@/components/queue/realtime-dot';
import { useQueueStore } from '@/lib/queue/store';
import { getCheckout, getInChair, getWaiting } from '@/lib/queue/selectors';
import { useCallIn, useQueueSnapshot, useReturnToQueue, useStartConsultation } from '@/lib/queue/mutations';
import { callInInitial, callInReducer, isCallingIn } from '@/lib/queue/call-in-machine';
import { ApiError } from '@/lib/api-client';
import { useToast } from '@/lib/toast';

export default function ConsultPage() {
  const router = useRouter();
  const toast = useToast();
  const snapshot = useQueueSnapshot('me');
  const state = useQueueStore((s) => s.state);
  const myDoctorId = useQueueStore((s) => s.myDoctorId) ?? undefined;

  const inChair = getInChair(state, myDoctorId);
  const waiting = getWaiting(state, myDoctorId);
  const checkout = getCheckout(state, myDoctorId);

  const [callIn, dispatch] = useReducer(callInReducer, callInInitial);
  const callInMut = useCallIn();
  const returnMut = useReturnToQueue();
  const startConsult = useStartConsultation();

  async function onCallIn(visitId: string) {
    dispatch({ type: 'START', visitId });
    try {
      await callInMut.mutateAsync({ id: visitId });
      dispatch({ type: 'OK', visitId });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      dispatch({ type: 'FAIL', visitId, code });
      toast.error(code === 'STALE_VERSION' ? 'Someone else already moved this patient' : 'Could not call the patient in');
    }
  }

  async function onRecord() {
    if (!inChair) return;
    try {
      const res = await startConsult.mutateAsync({ patientId: inChair.patient.id, visitId: inChair.id });
      router.push(`/consult/${res.consultationId}`);
    } catch {
      toast.error('Could not start the consultation');
    }
  }

  async function onReturn() {
    if (!inChair) return;
    try {
      await returnMut.mutateAsync({ id: inChair.id });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Could not return to queue');
    }
  }

  const empty = !inChair && waiting.length === 0 && checkout.length === 0;

  return (
    <AnimatedPage className="flex flex-1 flex-col">
      <header className="flex items-center justify-between px-3 pt-3">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex size-10 items-center justify-center rounded-pill text-foreground hover:bg-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="flex items-center gap-2 text-base font-semibold text-ink">
            Consultation
            <RealtimeDot />
          </h1>
        </div>
        <ProfileButton />
      </header>
      <OfflineBanner />

      {snapshot.isLoading && state.lastSyncedAt === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-5 text-text-muted" />
        </div>
      ) : empty ? (
        <div className="flex flex-1 items-center justify-center px-5">
          <EmptyState
            mascot="sleeping"
            variant="page"
            title="No one is waiting"
            body="Patients reception checks in will appear here instantly."
          />
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-6 px-5 pb-28 pt-4">
          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-subtle">Now treating</h2>
            <AnimatePresence mode="popLayout">
              {inChair ? (
                <InChairCard
                  key={inChair.id}
                  visit={inChair}
                  onRecord={onRecord}
                  onReturn={onReturn}
                  busyRecord={startConsult.isPending}
                  busyReturn={returnMut.isPending}
                />
              ) : (
                <EmptyState
                  key="empty-chair"
                  variant="inline"
                  icon={<Armchair />}
                  iconTone="neutral"
                  title="The chair is empty"
                  body="Call a waiting patient in to begin."
                />
              )}
            </AnimatePresence>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-subtle">
              Waiting · {waiting.length}
            </h2>
            <motion.div className="space-y-2" variants={staggerChildren(0.04)} initial="hidden" animate="show">
              <AnimatePresence mode="popLayout">
                {waiting.map((v) => (
                  <WaitingRow
                    key={v.id}
                    visit={v}
                    calling={isCallingIn(callIn, v.id)}
                    onCallIn={() => onCallIn(v.id)}
                    onOpen={() => router.push(`/patients/${v.patient.id}`)}
                  />
                ))}
              </AnimatePresence>
              {waiting.length === 0 ? (
                <EmptyState
                  variant="inline"
                  icon={<Armchair />}
                  iconTone="sky"
                  title="No one waiting"
                  body="The queue is clear."
                />
              ) : null}
            </motion.div>
          </section>

          {checkout.length > 0 ? (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-subtle">
                Checkout · {checkout.length}
              </h2>
              <div className="space-y-2">
                {checkout.map((v) => (
                  <CheckoutRow key={v.id} visit={v} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </AnimatedPage>
  );
}
