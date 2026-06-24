'use client';

import { AnimatedPage } from '@/components/animated-page';
import { BackHeader } from '@/components/onboarding/back-header';
import { EmptyState } from '@/components/empty-state';
import { HappyTooth } from '@/components/illustrations';

export default function ConsultPage() {
  return (
    <AnimatedPage className="flex flex-1 flex-col">
      <BackHeader title="Consultation" />
      <div className="flex flex-1 items-center justify-center">
        <EmptyState
          illustration={<HappyTooth />}
          title="The chair is empty."
          body="Open a patient and tap Record findings to start a voice consultation. The live queue arrives in Phase 4."
        />
      </div>
    </AnimatedPage>
  );
}
