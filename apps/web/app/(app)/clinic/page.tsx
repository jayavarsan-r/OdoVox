'use client';

import { useRouter } from 'next/navigation';
import { FileText, ChevronRight, CalendarClock, CalendarOff, MessageCircle } from 'lucide-react';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading, HeroCard } from '@/components/ds';
import { IlluBuildingSoon } from '@/components/illustrations';

export default function ClinicPage() {
  const router = useRouter();
  return (
    <AnimatedPage>
      <div className="flex flex-col gap-5 px-4 pb-28 pt-4">
        <EditorialHeading title="Clinic" />

        <HeroCard
          variant="light"
          size="compact"
          title="Prescription templates"
          subtitle="Reusable medicine bundles for common cases"
          icon={<FileText />}
          trailing={<ChevronRight />}
          onClick={() => router.push('/clinic/templates')}
        />

        <HeroCard
          variant="light"
          size="compact"
          title="Doctor availability"
          subtitle="Weekly working hours per doctor"
          icon={<CalendarClock />}
          trailing={<ChevronRight />}
          onClick={() => router.push('/clinic/availability')}
        />

        <HeroCard
          variant="light"
          size="compact"
          title="Days off & closures"
          subtitle="Block clinic days or a doctor's leave"
          icon={<CalendarOff />}
          trailing={<ChevronRight />}
          onClick={() => router.push('/clinic/day-off')}
        />

        <HeroCard
          variant="light"
          size="compact"
          title="WhatsApp"
          subtitle="Templates, budget & delivery costs"
          icon={<MessageCircle />}
          trailing={<ChevronRight />}
          onClick={() => router.push('/clinic/whatsapp')}
        />

        <div className="rounded-xl border border-dashed border-border p-6 text-center">
          <div className="mx-auto mb-3 w-24">
            <IlluBuildingSoon />
          </div>
          <p className="font-medium text-ink">Team, rooms &amp; join code</p>
          <p className="mt-1 text-sm text-text-muted">More clinic settings expand later.</p>
        </div>
      </div>
    </AnimatedPage>
  );
}
