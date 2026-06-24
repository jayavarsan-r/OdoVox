'use client';

import { useRouter } from 'next/navigation';
import { Stethoscope, UserCheck } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { AnimatedPage } from '@/components/animated-page';
import { EditorialHeading, HeroCard } from '@/components/ds';
import { MascotMoment } from '@/components/illustrations';
import { useOnboarding } from '@/lib/onboarding-store';

export default function RolePage() {
  const router = useRouter();
  const setRole = useOnboarding((s) => s.setRole);

  const pick = (role: 'DOCTOR' | 'RECEPTIONIST') => {
    setRole(role);
    router.push(role === 'DOCTOR' ? '/clinic-choice' : '/clinic-join');
  };

  return (
    <MobileShell className="bg-paper px-7">
      <AnimatedPage className="flex flex-1 flex-col">
        <div className="flex flex-col items-center pt-10">
          <MascotMoment pose="thinking" size="lg" animation="float" background="cream" />
        </div>

        <div className="mt-8">
          <EditorialHeading title="What's your role?" subtitle="This sets up your workspace." />
        </div>

        <div className="mt-7 space-y-3">
          <HeroCard
            variant="light"
            icon={<Stethoscope />}
            title="Doctor"
            subtitle="I'm a dentist or specialist"
            onClick={() => pick('DOCTOR')}
          />
          <HeroCard
            variant="light"
            icon={<UserCheck />}
            title="Receptionist"
            subtitle="I manage the front desk"
            onClick={() => pick('RECEPTIONIST')}
          />
        </div>
      </AnimatedPage>
    </MobileShell>
  );
}
