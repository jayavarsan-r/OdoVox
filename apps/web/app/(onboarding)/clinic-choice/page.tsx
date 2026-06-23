'use client';

import { useRouter } from 'next/navigation';
import { Building2, KeyRound } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { GradientMesh } from '@/components/gradient-mesh';
import { BackHeader } from '@/components/onboarding/back-header';
import { ChoiceCard } from '@/components/onboarding/choice-card';

export default function ClinicChoicePage() {
  const router = useRouter();
  return (
    <MobileShell>
      <GradientMesh preset="three" />
      <BackHeader />
      <div className="flex flex-1 flex-col justify-center px-7">
        <h1 className="text-2xl font-semibold tracking-tight">Your clinic</h1>
        <p className="mt-1.5 text-base text-muted-foreground">Set up or join a clinic.</p>

        <div className="mt-8 space-y-3">
          <ChoiceCard
            icon={<Building2 className="size-6" />}
            title="Create a new clinic"
            subtitle="I'll be the clinic admin"
            accent="bg-lime-soft"
            onClick={() => router.push('/clinic-create')}
          />
          <ChoiceCard
            icon={<KeyRound className="size-6" />}
            title="Join an existing clinic"
            subtitle="I have a join code"
            accent="bg-lavender-soft"
            onClick={() => router.push('/clinic-join')}
          />
        </div>
      </div>
    </MobileShell>
  );
}
