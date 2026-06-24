'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Calendar, IndianRupee, CircleDot } from 'lucide-react';
import type { VisitWithPatient } from '@odovox/types';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EditorialHeading, EmptyState, FabMenu, StatTile } from '@/components/ds';
import { Skeleton } from '@/components/ui/skeleton';
import { InitialsAvatar, WaitingRow, CheckoutRow } from '@/components/queue/queue-cards';
import { OfflineBanner, RealtimeDot } from '@/components/queue/realtime-dot';
import { ActivityFeed } from '@/components/queue/activity-feed';
import { WalkInSheet } from '@/components/queue/walk-in-sheet';
import { CheckoutSheet } from '@/components/queue/checkout-sheet';
import { QueueActionSheet } from '@/components/queue/queue-action-sheet';
import { useQueueStore } from '@/lib/queue/store';
import { getByDoctor, getCheckout } from '@/lib/queue/selectors';
import { useActivityFeed, useQueueSnapshot } from '@/lib/queue/mutations';
import { useTodayStats } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/lib/toast';

export default function TodayPage() {
  const router = useRouter();
  const toast = useToast();
  const { clinic } = useAuth();
  const stats = useTodayStats();
  const snapshot = useQueueSnapshot('all');
  useActivityFeed(true);
  const state = useQueueStore((s) => s.state);

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [checkoutVisit, setCheckoutVisit] = useState<VisitWithPatient | null>(null);
  const [actionVisit, setActionVisit] = useState<VisitWithPatient | null>(null);

  const doctorQueues = getByDoctor(state).filter((d) => d.available || d.inChair || d.waiting.length > 0);
  const checkout = getCheckout(state);
  const inChairCount = doctorQueues.filter((d) => d.inChair).length;
  const eyebrow = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <AnimatedPage className="flex flex-1 flex-col">
      <div className="px-5 pt-4">
        <EditorialHeading
          eyebrow={eyebrow.toUpperCase()}
          title="Today"
          subtitle={clinic?.name ?? 'Your clinic'}
          trailing={
            <div className="flex items-center gap-2">
              <RealtimeDot />
              <ProfileButton />
            </div>
          }
        />
      </div>
      <OfflineBanner />

      <div className="flex flex-1 flex-col gap-6 px-5 pb-28 pt-4">
        {stats.isLoading ? (
          <Skeleton className="h-20 w-full" />
        ) : (
          <div className="grid grid-cols-3 gap-3">
            <StatTile variant="lime" value={stats.data?.appointmentsToday ?? 0} label="Appointments" />
            <StatTile variant="sage" value={inChairCount} label="In chair" />
            <StatTile variant="warning" value={checkout.length} label="Ready to bill" />
          </div>
        )}

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-subtle">Active queue · live</h2>
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
            <div className="space-y-3">
              {doctorQueues.map((d) => (
                <div key={d.doctorId} className="rounded-2xl border border-border bg-surface p-3 shadow-elev-1">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-semibold text-ink">{d.doctorName ?? 'Doctor'}</span>
                    {!d.available ? <span className="text-xs text-text-subtle">off today</span> : null}
                  </div>
                  {d.inChair ? (
                    <div className="mb-2 flex items-center gap-2 rounded-lg bg-sage-tint p-2">
                      <InitialsAvatar name={d.inChair.patient.name} className="size-8 text-xs" />
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{d.inChair.patient.name}</span>
                      {d.inChair.recording ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                          <CircleDot className="size-3 animate-pulse" /> recording
                        </span>
                      ) : (
                        <span className="text-xs font-medium text-sage-deep">In chair</span>
                      )}
                    </div>
                  ) : (
                    <p className="mb-2 rounded-lg bg-paper-warm p-2 text-xs text-text-muted">Chair empty</p>
                  )}
                  {d.waiting.length > 0 ? (
                    <div className="space-y-2">
                      {d.waiting.map((v) => (
                        <WaitingRow key={v.id} visit={v} onLongPress={() => setActionVisit(v)} onOpen={() => router.push(`/patients/${v.patient.id}`)} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-subtle">No one waiting</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-subtle">
            Ready for checkout · {checkout.length}
          </h2>
          {checkout.length === 0 ? (
            <EmptyState
              variant="inline"
              icon={<IndianRupee />}
              iconTone="peach"
              title="Nothing to bill yet"
              body="Confirmed consultations land here for payment."
            />
          ) : (
            <div className="space-y-2">
              {checkout.map((v) => (
                <CheckoutRow key={v.id} visit={v} onTakePayment={() => setCheckoutVisit(v)} />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-subtle">Recent activity</h2>
          <ActivityFeed />
        </section>
      </div>

      <FabMenu
        items={[
          { id: 'walk-in', label: 'Add walk-in', tone: 'lime', icon: <UserPlus />, onClick: () => setWalkInOpen(true) },
          { id: 'new-patient', label: 'New patient', tone: 'peach', icon: <UserPlus />, onClick: () => router.push('/patients/new') },
          { id: 'add-payment', label: 'Add payment', tone: 'sage', icon: <IndianRupee />, onClick: () => toast.info('Payments arrive in Phase 8.') },
          { id: 'new-appointment', label: 'New appointment', tone: 'sky', icon: <Calendar />, onClick: () => toast.info('Scheduling arrives in Phase 6.') },
        ]}
      />

      <WalkInSheet open={walkInOpen} onClose={() => setWalkInOpen(false)} />
      <CheckoutSheet visit={checkoutVisit} open={!!checkoutVisit} onClose={() => setCheckoutVisit(null)} />
      <QueueActionSheet visit={actionVisit} open={!!actionVisit} onClose={() => setActionVisit(null)} />
    </AnimatedPage>
  );
}
