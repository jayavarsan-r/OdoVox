'use client';

import { useRouter } from 'next/navigation';
import { UserPlus, Calendar, IndianRupee, Users, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { EditorialHeading, EmptyState, FabMenu, HeroCard, StatTile } from '@/components/ds';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { useTodayStats, useTodayActivity } from '@/lib/queries';

export default function TodayPage() {
  const router = useRouter();
  const toast = useToast();
  const { clinic } = useAuth();
  const stats = useTodayStats();
  const activity = useTodayActivity();
  const soon = (phase: string) => () => toast.info(`Coming in ${phase}.`);

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-6 px-5 pt-4">
      <EditorialHeading title="Today" subtitle={clinic?.name ?? 'Your clinic'} trailing={<ProfileButton />} />

      {stats.isLoading ? (
        <Skeleton className="h-20 w-full" />
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <StatTile variant="lime" value={stats.data?.appointmentsToday ?? 0} label="Appointments today" />
          <StatTile variant="sage" value={stats.data?.patientsSeen ?? 0} label="Patients seen" />
          <StatTile variant="warning" value={stats.data?.waiting ?? 0} label="Pending check-ins" />
        </div>
      )}

      <div className="grid grid-cols-1 gap-3">
        <HeroCard
          variant="light"
          size="compact"
          icon={<UserPlus />}
          title="New patient"
          onClick={() => router.push('/patients/new')}
        />
        <HeroCard
          variant="light"
          size="compact"
          icon={<Calendar />}
          title="New appointment"
          onClick={soon('Phase 6')}
        />
        <HeroCard
          variant="light"
          size="compact"
          icon={<IndianRupee />}
          title="Add payment"
          onClick={soon('Phase 8')}
        />
      </div>

      <section className="flex-1 space-y-5">
        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-widest text-text-subtle">LIVE QUEUE</h2>
          <EmptyState
            variant="inline"
            icon={<Users />}
            iconTone="sky"
            title="Live queue arrives in Phase 4"
            body="Queue and check-in will appear here."
          />
        </div>

        <div>
          <h2 className="mb-2 text-xs font-semibold tracking-widest text-text-subtle">RECENT ACTIVITY</h2>
          {activity.isLoading ? (
            <Skeleton className="h-16 w-full rounded-2xl" />
          ) : (activity.data?.items.length ?? 0) === 0 ? (
            <EmptyState
              variant="inline"
              icon={<Activity />}
              iconTone="sage"
              title="No completed consultations yet"
              body="Confirmed voice consultations show up here."
            />
          ) : (
            <div className="space-y-2">
              {activity.data!.items.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => a.patientId && router.push(`/patients/${a.patientId}`)}
                  className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left shadow-elev-1"
                >
                  <span className={cn('size-2 shrink-0 rounded-pill', a.withWarning ? 'bg-warning' : 'bg-sage')} />
                  <span className="flex-1 text-sm">{a.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      <FabMenu
        items={[
          {
            id: 'new-patient',
            label: 'New patient',
            tone: 'peach',
            icon: <UserPlus />,
            onClick: () => router.push('/patients/new'),
          },
          {
            id: 'new-appointment',
            label: 'New appointment',
            tone: 'sky',
            icon: <Calendar />,
            onClick: soon('Phase 6'),
          },
          {
            id: 'add-payment',
            label: 'Add payment',
            tone: 'sage',
            icon: <IndianRupee />,
            onClick: soon('Phase 8'),
          },
        ]}
      />
    </AnimatedPage>
  );
}
