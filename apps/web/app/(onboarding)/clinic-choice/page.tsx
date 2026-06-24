'use client';

import { useRouter } from 'next/navigation';
import { Building2, KeyRound } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { AnimatedPage } from '@/components/animated-page';
import { BackHeader } from '@/components/onboarding/back-header';
import { EditorialHeading, HeroCard } from '@/components/ds';
import { MascotMoment } from '@/components/illustrations';

export default function ClinicChoicePage() {
  const router = useRouter();
  return (
    <MobileShell className="bg-paper">
      <BackHeader />
      <AnimatedPage className="flex flex-1 flex-col px-7">
        <div className="flex flex-col items-center pt-6">
          <MascotMoment pose="hero" size="md" animation="float" background="cream" />
        </div>
        <div className="mt-7">
          <EditorialHeading title="Your clinic" subtitle="Two minutes. Three steps." />
        </div>

        <div className="mt-7 space-y-3">
          <HeroCard
            variant="light"
            icon={<Building2 />}
            title="Create a new clinic"
            subtitle="I'll be the clinic admin"
            onClick={() => router.push('/clinic-create/step-1-basics')}
          />
          <HeroCard
            variant="light"
            icon={<KeyRound />}
            title="Join an existing clinic"
            subtitle="I have a join code"
            onClick={() => router.push('/clinic-join')}
          />
        </div>
      </AnimatedPage>
    </MobileShell>
  );
}
