"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { StepperHeader } from "@/components/ds";
import { WIZARD_STEPS, type WizardStepId } from "@/lib/ds/wizard";

/**
 * Shared chrome for the clinic-create wizard, in the frame-08 `.ob` language:
 * 22px gutters, a 40px back `.icirc`, and the step indicator.
 *
 * Frame 08 collapses clinic creation to a single screen ("Name → clinic → city.
 * Done."), with hours and chairs shipped as defaults. We keep all THREE steps —
 * feature parity outranks spec fidelity (Global Constraint 1), and the hours and
 * profile steps capture data the single screen simply drops. Each step wears the
 * frame's visual language instead.
 *
 * Back returns to an explicit href; wizard state lives in the onboarding store, so
 * nothing is lost on the way back.
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
      <div className="flex items-center gap-2.5 px-gutter-onboarding pt-0.5">
        <Link
          href={backHref}
          aria-label="Go back"
          className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-surface text-pine shadow-icirc"
        >
          <ChevronLeft className="size-[18px]" />
        </Link>
        <StepperHeader
          steps={[...WIZARD_STEPS]}
          current={current}
          className="flex-1"
        />
      </div>
      {children}
    </MobileShell>
  );
}
