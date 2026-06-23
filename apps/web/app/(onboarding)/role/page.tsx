'use client';

import { useRouter } from 'next/navigation';
import { Stethoscope, UserCheck } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { GradientMesh } from '@/components/gradient-mesh';
import { ChoiceCard } from '@/components/onboarding/choice-card';
import { useOnboarding } from '@/lib/onboarding-store';

export default function RolePage() {
  const router = useRouter();
  const setRole = useOnboarding((s) => s.setRole);

  const pick = (role: 'DOCTOR' | 'RECEPTIONIST') => {
    setRole(role);
    router.push(role === 'DOCTOR' ? '/clinic-choice' : '/clinic-join');
  };

  return (
    <MobileShell className="px-7">
      <GradientMesh preset="three" />
      <div className="flex flex-1 flex-col justify-center">
        <h1 className="text-2xl font-semibold tracking-tight">What&apos;s your role?</h1>
        <p className="mt-1.5 text-base text-muted-foreground">This sets up your workspace.</p>

        <div className="mt-8 space-y-3">
          <ChoiceCard
            icon={<Stethoscope className="size-6" />}
            title="Doctor"
            subtitle="I'm a dentist or specialist"
            accent="bg-sky-soft"
            onClick={() => pick('DOCTOR')}
          />
          <ChoiceCard
            icon={<UserCheck className="size-6" />}
            title="Receptionist"
            subtitle="I manage the front desk"
            accent="bg-peach-soft"
            onClick={() => pick('RECEPTIONIST')}
          />
        </div>
      </div>
    </MobileShell>
  );
}
