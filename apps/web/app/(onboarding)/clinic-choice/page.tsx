'use client';

import { useRouter } from 'next/navigation';
import { Building2, KeyRound } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { AnimatedPage } from '@/components/animated-page';
import { BackHeader } from '@/components/onboarding/back-header';
import { ChoiceCard } from '@/components/onboarding/choice-card';
import { MascotMoment } from '@/components/illustrations';

export default function ClinicChoicePage() {
  const router = useRouter();
  return (
    <MobileShell className="bg-paper">
      <BackHeader />
      <AnimatedPage className="flex flex-1 flex-col px-gutter-onboarding">
        <div className="flex flex-col items-center pt-6">
          <MascotMoment pose="hero" size="md" animation="float" background="cream" />
        </div>
        <div className="mt-7">
          <h1 className="text-question font-heavy leading-[1.15] tracking-tight text-pine">
            Your clinic
          </h1>
          <p className="mt-2 text-sm leading-[1.5] text-pine-2">Two minutes. Three steps.</p>
        </div>

        {/* No frame covers this screen — the spec routes Role straight to Create or
            Join. It is kept (Global Constraint 1) and redesigned in the same .rolec
            language as frame 07, so the flow reads as one piece. */}
        <div className="mt-4 space-y-4">
          <ChoiceCard
            icon={<Building2 />}
            accent="bg-lime-soft text-pine"
            title="Create a new clinic"
            subtitle="I'll be the clinic admin"
            onClick={() => router.push('/clinic-create/step-1-basics')}
          />
          <ChoiceCard
            icon={<KeyRound />}
            accent="bg-lav-soft text-lav"
            title="Join an existing clinic"
            subtitle="I have a join code"
            onClick={() => router.push('/clinic-join')}
          />
        </div>
      </AnimatedPage>
    </MobileShell>
  );
}
