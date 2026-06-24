'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Stethoscope,
  ArrowRight,
  UserPlus,
  Calendar,
  Pill,
  Boxes,
  FlaskConical,
  CalendarOff,
  ChevronRight,
  Bell,
  Clock,
} from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { ProfileButton } from '@/components/app-shell/profile-button';
import { VoiceSearchInput } from '@/components/voice-search-input';
import { EmptyState, FabMenu, HeroCard } from '@/components/ds';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth';
import { useNeedsYou, useRecentVisits } from '@/lib/queries';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Pastel tile with a saturated matching colored icon, subtitle, and chevron. */
function QuickTile({
  label,
  subtitle,
  icon,
  accent,
  iconColor,
  onClick,
}: {
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  accent: string;
  iconColor: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-start rounded-2xl p-4 text-left shadow-elev-1 transition-all duration-fast hover:shadow-elev-2 active:scale-[0.98]',
        accent,
      )}
    >
      <ChevronRight className="absolute right-3 top-3 size-4 text-text-subtle" />
      <span className="flex size-10 items-center justify-center rounded-md bg-paper/50 backdrop-blur-sm">
        <span className={cn('[&_svg]:size-6', iconColor)}>{icon}</span>
      </span>
      <span className="mt-3 text-base font-semibold text-ink">{label}</span>
      <span className="text-[13px] text-text-muted">{subtitle}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xs font-semibold tracking-widest text-text-subtle">{children}</h2>;
}

export default function DoctorHomePage() {
  const router = useRouter();
  const toast = useToast();
  const { user, clinic } = useAuth();
  const [search, setSearch] = useState('');
  const needsYou = useNeedsYou();
  const recent = useRecentVisits();

  const now = new Date();
  const dateLabel = `${WEEKDAYS[now.getDay()]}, ${now.getDate()} ${MONTHS[now.getMonth()]}`;
  const raw = (user?.name || 'Doctor').replace(/^Dr\.?\s*/i, '').split(' ')[0] || 'Doctor';
  const firstName = raw.charAt(0).toUpperCase() + raw.slice(1);
  const soon = (phase: string) => () => toast.info(`Coming in ${phase}.`);
  const needsCount = needsYou.data?.items.length ?? 0;

  return (
    <AnimatedPage className="flex flex-1 flex-col gap-6 px-5 pt-4">
      {/* Greeting */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-muted">{dateLabel}</p>
          <h1 className="mt-1 text-[32px] font-semibold leading-tight tracking-tight text-ink">
            Hi, Dr. {firstName}
          </h1>
          <p className="mt-1 truncate text-base text-text-muted">
            {clinic?.name ?? 'Your clinic'}
            {clinic?.city ? ` · ${clinic.city}` : ''}
          </p>
        </div>
        <ProfileButton />
      </header>

      {/* Search */}
      <VoiceSearchInput
        value={search}
        onChange={setSearch}
        onSubmit={(v) => router.push(`/patients${v ? `?search=${encodeURIComponent(v)}` : ''}`)}
      />

      {/* Start consultation hero (depth handled by HeroCard dark) */}
      <HeroCard
        variant="dark"
        icon={<Stethoscope />}
        title="Start consultation"
        subtitle="Queue is clear"
        trailing={<ArrowRight />}
        onClick={() => router.push('/consult')}
      />

      {/* Quick tools */}
      <div className="grid grid-cols-2 gap-3">
        <QuickTile label="New patient" subtitle="Add a new patient" icon={<UserPlus />} accent="bg-peach-soft" iconColor="text-tool-patient" onClick={() => router.push('/patients/new')} />
        <QuickTile label="Appointment" subtitle="View & manage" icon={<Calendar />} accent="bg-sky-soft" iconColor="text-info" onClick={soon('Phase 6')} />
        <QuickTile label="Inventory" subtitle="Stock & supplies" icon={<Boxes />} accent="bg-sage-tint" iconColor="text-tool-inventory" onClick={soon('Phase 7')} />
        <QuickTile label="Lab tracker" subtitle="Track lab cases" icon={<FlaskConical />} accent="bg-lavender-soft" iconColor="text-tool-lab" onClick={() => router.push('/lab')} />
        <QuickTile label="Day off" subtitle="Manage leaves" icon={<CalendarOff />} accent="bg-lime-soft" iconColor="text-tool-dayoff" onClick={soon('Phase 6')} />
      </div>

      {/* Today */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>TODAY · 0</SectionLabel>
          <button onClick={() => router.push('/schedule')} className="text-sm font-medium text-info">
            Schedule →
          </button>
        </div>
        <EmptyState
          variant="inline"
          icon={<Calendar />}
          iconTone="sky"
          title="No appointments scheduled."
          body="Scheduling arrives in Phase 6."
        />
      </section>

      {/* Needs you */}
      <section>
        <h2 className={cn('mb-2 text-xs font-semibold tracking-widest', needsCount > 0 ? 'text-lime' : 'text-text-subtle')}>
          NEEDS YOU · {needsCount}
        </h2>
        {needsYou.isLoading ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : needsCount === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Bell />}
            iconTone="info"
            title="All caught up!"
            body="You're all clear for now."
          />
        ) : (
          <div className="space-y-2">
            {needsYou.data!.items.map((item, i) => (
              <button
                key={i}
                onClick={() => router.push(`/patients/${item.patientId}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left shadow-elev-1"
              >
                <span className="size-2 shrink-0 rounded-pill bg-lime" />
                <span className="flex-1 text-sm font-medium">{item.title}</span>
                <ChevronRight className="size-4 text-text-subtle" />
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Recent */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <SectionLabel>RECENT APPOINTMENTS</SectionLabel>
          <button onClick={() => router.push('/patients')} className="text-sm font-medium text-text-muted">
            See all →
          </button>
        </div>
        {recent.isLoading ? (
          <Skeleton className="h-16 w-full rounded-2xl" />
        ) : (recent.data?.items.length ?? 0) === 0 ? (
          <EmptyState
            variant="inline"
            icon={<Clock />}
            iconTone="neutral"
            title="No visits yet"
            body="Recorded visits show up here."
          />
        ) : (
          <div className="space-y-2">
            {recent.data!.items.map((v) => (
              <button
                key={v.id}
                onClick={() => router.push(`/patients/${v.patientId}`)}
                className="flex w-full items-center gap-3 rounded-lg border border-border bg-surface p-3 text-left shadow-elev-1"
              >
                <div className="flex-1">
                  <p className="text-sm font-medium">{v.patientName}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(v.date).toLocaleDateString('en-IN')} · {v.procedureSummary}
                  </p>
                </div>
                <ChevronRight className="size-4 text-text-subtle" />
              </button>
            ))}
          </div>
        )}
      </section>

      <FabMenu
        items={[
          { id: 'new-patient', label: 'New patient', tone: 'peach', icon: <UserPlus />, onClick: () => router.push('/patients/new') },
          { id: 'new-appointment', label: 'New appointment', tone: 'sky', icon: <Calendar />, onClick: soon('Phase 6') },
          { id: 'quick-rx', label: 'Quick prescription', tone: 'sage', icon: <Pill />, onClick: soon('Phase 3') },
        ]}
      />
    </AnimatedPage>
  );
}
