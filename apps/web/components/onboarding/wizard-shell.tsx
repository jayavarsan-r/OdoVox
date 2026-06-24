'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { MobileShell } from '@/components/mobile-shell';
import { StepperHeader } from '@/components/ds';
import { WIZARD_STEPS, type WizardStepId } from '@/lib/ds/wizard';

/**
 * Shared chrome for the clinic-create wizard: warm gradient, a back chevron that
 * returns to an explicit href (state lives in the onboarding store, so nothing is
 * lost), and the <StepperHeader>. Children supply the step form + sticky CTA.
 */
export function WizardStepLayout({
  current,
  backHref,
  children,
}: {
  current: WizardStepId;
  backHref: string;
  children: ReactNode;
}) {
  return (
    <MobileShell className="bg-paper">
      <div className="flex items-center gap-2 px-5 pt-3">
        <Link
          href={backHref}
          aria-label="Go back"
          className="-ml-2 flex size-10 items-center justify-center rounded-pill text-foreground transition-colors hover:bg-muted"
        >
          <ChevronLeft className="size-5" />
        </Link>
        <StepperHeader steps={[...WIZARD_STEPS]} current={current} className="flex-1" />
      </div>
      {children}
    </MobileShell>
  );
}
