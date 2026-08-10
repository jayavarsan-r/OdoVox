"use client";

import { useReducer } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Armchair, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedPage } from "@/components/animated-page";
import { ProfileButton } from "@/components/app-shell/profile-button";
import { EmptyState, SectionHeader } from "@/components/ds";
import { staggerChildren } from "@/components/ds/motion";
import { Spinner } from "@/components/ui/spinner";
import {
  InChairCard,
  WaitingRow,
  CheckoutRow,
} from "@/components/queue/queue-cards";
import { RealtimeDot } from "@/components/queue/realtime-dot";
import { OfflineBanner } from "@/components/ds";
import { Chip } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MascotMoment } from "@/components/illustrations";
import { useQueueStore } from "@/lib/queue/store";
import { getCheckout, getInChair, getWaiting } from "@/lib/queue/selectors";
import {
  useCallIn,
  useQueueSnapshot,
  useReturnToQueue,
  useStartConsultation,
} from "@/lib/queue/mutations";
import {
  callInInitial,
  callInReducer,
  isCallingIn,
} from "@/lib/queue/call-in-machine";
import { ApiError } from "@/lib/api-client";
import { useToast } from "@/lib/toast";

export default function ConsultPage() {
  const router = useRouter();
  const toast = useToast();
  const snapshot = useQueueSnapshot("me");
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
    dispatch({ type: "START", visitId });
    try {
      await callInMut.mutateAsync({ id: visitId });
      dispatch({ type: "OK", visitId });
    } catch (e) {
      const code = e instanceof ApiError ? e.code : undefined;
      dispatch({ type: "FAIL", visitId, code });
      toast.error(
        code === "STALE_VERSION"
          ? "Someone else already moved this patient"
          : "Could not call the patient in",
      );
    }
  }

  async function onRecord() {
    if (!inChair) return;
    try {
      const res = await startConsult.mutateAsync({
        patientId: inChair.patient.id,
        visitId: inChair.id,
      });
      router.push(`/consult/${res.consultationId}`);
    } catch {
      toast.error("Could not start the consultation");
    }
  }

  async function onReturn() {
    if (!inChair) return;
    try {
      await returnMut.mutateAsync({ id: inChair.id });
    } catch (e) {
      toast.error(
        e instanceof ApiError ? e.message : "Could not return to queue",
      );
    }
  }

  const empty = !inChair && waiting.length === 0 && checkout.length === 0;

  return (
    <AnimatedPage className="flex flex-1 flex-col">
      {/* Frame 21: a 28px display title with a live/quiet status chip. The back
          control stays — /consult is not one of the four dock tabs, so removing it
          would strand anyone who arrived from Flow's "Continue consultation". */}
      <header className="flex items-center justify-between gap-3 px-gutter pt-2.5">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="-ml-2 flex size-10 shrink-0 items-center justify-center rounded-pill text-pine"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="truncate text-[28px] font-heavy tracking-tight text-pine">
            Consult
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {empty ? (
            <Chip tone="neutral">Quiet</Chip>
          ) : (
            <Chip tone="live">
              <RealtimeDot />
              Live
            </Chip>
          )}
          <ProfileButton />
        </div>
      </header>
      <OfflineBanner className="mx-gutter mt-2" />

      {snapshot.isLoading && state.lastSyncedAt === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <Spinner className="size-5 text-text-muted" />
        </div>
      ) : empty ? (
        /* Frame 22. The frame does not just say the queue is empty — it offers the two
           things a doctor would actually do next. An empty screen with no way forward
           is where the old version left you. */
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-gutter">
          <MascotMoment pose="sleeping" size="lg" animation="float" />
          <p className="text-[19px] font-heavy tracking-tight text-pine">
            No one waiting
          </p>
          <p className="text-center text-[12.5px] font-semibold text-pine-2">
            Anyone reception checks in appears here instantly.
          </p>
          <div className="mt-1 flex w-full flex-col gap-2.5">
            <Button block onClick={() => router.push("/patients/new")}>
              <Plus /> Add walk-in
            </Button>
            <Button
              variant="outline"
              block
              onClick={() => router.push("/schedule")}
            >
              Open schedule
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col gap-1 pb-28 pt-1">
          <section className="[&>div]:px-gutter">
            <SectionHeader
              title="Now treating"
              action={inChair?.roomName ?? undefined}
            />
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
            <SectionHeader title="Waiting" action={String(waiting.length)} />
            <motion.div
              className="mx-gutter divide-y divide-hair overflow-hidden rounded-2xl bg-card shadow-tile"
              variants={staggerChildren(0.04)}
              initial="hidden"
              animate="show"
            >
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
              <SectionHeader
                title="Sent to checkout"
                action={String(checkout.length)}
              />
              <div className="mx-gutter divide-y divide-hair overflow-hidden rounded-2xl bg-card shadow-tile">
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
