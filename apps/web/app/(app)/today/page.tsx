'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { UserPlus, IndianRupee, CircleDot } from 'lucide-react';
import type { VisitWithPatient } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import {
  BentoTile,
  EmptyState,
  SectionHeader,
} from '@/components/ds';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/badge';
import { InitialsAvatar as DsAvatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { WaitingRow, CheckoutRow } from '@/components/queue/queue-cards';
import { RealtimeDot } from '@/components/queue/realtime-dot';
import { OfflineBanner } from '@/components/ds';
import { WalkInSheet } from '@/components/queue/walk-in-sheet';
import { CheckoutSheet } from '@/components/queue/checkout-sheet';
import { QueueActionSheet } from '@/components/queue/queue-action-sheet';
import { useQueueStore } from '@/lib/queue/store';
import { getByDoctor, getCheckout } from '@/lib/queue/selectors';
import { useQueueSnapshot } from '@/lib/queue/mutations';
import { useTodayStats } from '@/lib/queries';
import { useDailyCollection } from '@/lib/billing/api';
import { pendingCheckoutPaise, freeRooms } from '@/lib/queue/today-state';
import { rupeesCompact } from '@/lib/billing/format';
import { useAuth } from '@/lib/auth';

function TodayInner() {
  const router = useRouter();
  const { clinic } = useAuth();
  const stats = useTodayStats();
  const collection = useDailyCollection();
  const snapshot = useQueueSnapshot('all');
  const state = useQueueStore((s) => s.state);

  // The orb's "Add walk-in" row routes to /today?walkin=1 — open the sheet on arrival.
  const params = useSearchParams();
  const [walkInOpen, setWalkInOpen] = useState(params.get('walkin') === '1');
  const [walkInVoice, setWalkInVoice] = useState(false);
  const [checkoutVisit, setCheckoutVisit] = useState<VisitWithPatient | null>(null);
  const [actionVisit, setActionVisit] = useState<VisitWithPatient | null>(null);

  const doctorQueues = getByDoctor(state).filter((d) => d.available || d.inChair || d.waiting.length > 0);
  // Rooms nobody is sitting in — real snapshot state, not a guess (#74).
  const openRooms = freeRooms(
    state.rooms,
    getByDoctor(state).map((d) => d.inChair?.roomId ?? null),
  );
  const checkout = getCheckout(state);

  // Frame 50: "MON · 13 JUL" — short weekday, middot separator.
  const now = new Date();
  const eyebrow = `${now.toLocaleDateString('en-IN', { weekday: 'short' })} · ${now.getDate()} ${now.toLocaleDateString('en-IN', { month: 'short' })}`;

  return (
    <AnimatedPage className="flex flex-1 flex-col">
      {/* Frame 50 — the eyebrow carries the live marker, and the clinic name moves
          into it so the title line stays a single 28px word. */}
      <header className="flex items-start justify-between gap-3 px-gutter pt-2.5">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-eyebrow font-heavy uppercase tracking-eyebrow text-pine-3">
            {eyebrow.toUpperCase()}
            <span className="text-pine-3">·</span>
            <span className="flex items-center gap-1 text-live">
              <RealtimeDot />
              LIVE
            </span>
          </p>
          <h1 className="mt-[5px] truncate text-[28px] font-heavy tracking-tight text-pine">
            Today
          </h1>
          <p className="truncate text-[11.5px] font-semibold text-pine-2">
            {clinic?.name ?? 'Your clinic'}
          </p>
        </div>
        <ProfileButton />
      </header>
      <OfflineBanner className="mx-gutter mt-2" />

      <div className="flex flex-1 flex-col gap-1 pb-28 pt-3">
        {/* Frame 50's bento: the day's money, two tiles, PENDING in crit.

            This replaced SEVEN tiles (4 collection + 3 stats). Nothing was thrown
            away — the three stats were already on this screen twice over: in-chair
            is visible in "Clinic now", the checkout count is that section's own
            action, and appointments-today moves onto the "Clinic now" header. Cash
            and Online remain one tap away in Billing, which is where a receptionist
            reconciling a drawer already goes. */}
        {collection.isLoading || !collection.data ? (
          <Skeleton className="mx-gutter h-[86px] rounded-2xl" />
        ) : (
          <div className="grid grid-cols-2 gap-gap-tight px-gutter">
            <BentoTile
              label="COLLECTED"
              value={rupeesCompact(collection.data.totalCollectedPaise)}
            />
            {/* Money, not a count. Beside COLLECTED, a bare "1" reads as ₹1 — and the
                person reading it is balancing a drawer. The count still shows on the
                Checkout section header, where it means people rather than rupees. */}
            <BentoTile
              tone={pendingCheckoutPaise(checkout) > 0 ? 'crit' : 'neutral'}
              label="PENDING"
              value={rupeesCompact(pendingCheckoutPaise(checkout))}
            />
          </div>
        )}

        {/* Frame 50 puts Messages in the section's action slot rather than giving it a
            banner of its own — it is a destination, not an event. */}
        <section>
          <SectionHeader
            title="Clinic now"
            action={`Messages${stats.data ? ` · ${stats.data.appointmentsToday} today` : ''}`}
            onAction={() => router.push('/messages')}
          />
          {snapshot.isLoading && state.lastSyncedAt === 0 ? (
            <Skeleton className="h-24 w-full rounded-2xl" />
          ) : doctorQueues.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={<UserPlus />}
              iconTone="sky"
              title="No one in the queue"
              body="Tap the + to check a walk-in patient in."
            />
          ) : (
            /* Frame 50 groups by doctor with an EYEBROW, not a card per doctor: one
               card, each doctor announced by a caption line. The free-chair caption
               carries its state inline ("CHAIR 2 — FREE"), which is how reception
               reads the room at a glance instead of counting empty boxes. */
            <Card className="mx-gutter divide-y divide-hair overflow-hidden py-0.5">
              {doctorQueues.map((d) => (
                <div key={d.doctorId} className="py-1">
                  <p className="px-4 pb-1 pt-1.5 text-[9.5px] font-heavy uppercase tracking-eyebrow text-pine-3">
                    {d.doctorName ?? 'Doctor'}
                    {d.inChair
                      ? ''
                      : d.available
                        ? ' — free'
                        : ' — off today'}
                  </p>
                  {d.inChair ? (
                    <div className="flex items-center gap-3 px-4 py-2">
                      <DsAvatar name={d.inChair.patient.name} ring="live" size="md" />
                      <span className="min-w-0 flex-1 truncate text-[14px] font-heavy text-pine">
                        {d.inChair.patient.name}
                      </span>
                      {d.inChair.recording ? (
                        <Chip tone="live">
                          <CircleDot className="size-2.5 animate-pulse" /> Rec
                        </Chip>
                      ) : (
                        <Chip tone="live">In chair</Chip>
                      )}
                    </div>
                  ) : null}
                  {d.waiting.map((v) => (
                    <WaitingRow
                      key={v.id}
                      visit={v}
                      onLongPress={() => setActionVisit(v)}
                      onOpen={() => router.push(`/patients/${v.patient.id}`)}
                    />
                  ))}
                </div>
              ))}
              {/* Frame 50's free-chair footer, ruled in on #74: which rooms are open,
                  which is what reception reads before placing a walk-in. Room NAMES come
                  from the data (#70) — the model says Room, so the UI says Room rather
                  than inventing a "Chair" the rest of the system does not use. The
                  frame's "NEXT 11:15" needs per-room appointment times, which this screen
                  does not fetch; it is omitted rather than guessed. */}
              {openRooms.length > 0 ? (
                <p className="px-4 pb-2 pt-1.5 text-[9.5px] font-heavy uppercase tracking-eyebrow text-pine-3">
                  {openRooms.map((r) => `${r.roomName} — free`).join(' · ')}
                </p>
              ) : null}
            </Card>
          )}
        </section>

        <section>
          <SectionHeader
            title="Checkout"
            action={String(checkout.length)}
            actionTone={checkout.length > 0 ? 'crit' : 'muted'}
          />
          {checkout.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={<IndianRupee />}
              iconTone="peach"
              title="Nothing to bill yet"
              body="Confirmed consultations land here for payment."
            />
          ) : (
            <Card className="mx-gutter divide-y divide-hair overflow-hidden py-0.5">
              {checkout.map((v) => (
                <CheckoutRow key={v.id} visit={v} onTakePayment={() => setCheckoutVisit(v)} />
              ))}
            </Card>
          )}
        </section>

      </div>

      {/* No floating FAB here. Frame 50's header carries only an avatar, so the frame
          relies on the dock ORB for actions — and a second floating button would both
          duplicate the orb and sit on top of "Recent activity". Ruling #41: the orb is
          the single global floating action/voice affordance.

          Nothing was dropped. "Add walk-in" and "Take a payment" moved into the orb's
          hold menu as reception-only rows; new patient, book and lab case were already
          there. The walk-in sheet still opens here, now via ?walkin=1. */}
      <WalkInSheet open={walkInOpen} voice={walkInVoice} onClose={() => { setWalkInOpen(false); setWalkInVoice(false); }} />
      <CheckoutSheet visit={checkoutVisit} open={!!checkoutVisit} onClose={() => setCheckoutVisit(null)} />
      <QueueActionSheet visit={actionVisit} open={!!actionVisit} onClose={() => setActionVisit(null)} />
    </AnimatedPage>
  );
}

/**
 * `useSearchParams` (the orb's ?walkin=1 hand-off) forces a suspense boundary — without
 * one Next fails the production build, which typecheck alone would not have caught.
 */
export default function TodayPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-gutter mt-4 h-40 rounded-2xl" />}>
      <TodayInner />
    </Suspense>
  );
}
