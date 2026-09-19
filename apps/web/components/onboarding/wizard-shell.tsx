"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { ObDots } from "@/components/ds";
import { Chip, Mini } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { WIZARD_STEPS, type WizardStepId } from "@/lib/ds/wizard";

/**
 * Shared chrome for the clinic-create wizard, in the frame-08 `.ob` language:
 * 22px gutters, a 40px back `.icirc`, and the spec's `.ob-dots` progress.
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
  onBack,
  children,
}: {
  current: WizardStepId;
  backHref: string;
  /**
   * Step 1 asks five questions on one route, so back has to walk them before it leaves
   * the step — otherwise the first tap discards four answered questions. When set, the
   * chevron becomes a button; otherwise it stays a real link to `backHref`.
   */
  onBack?: () => void;
  children: ReactNode;
}) {
  const chevron =
    "flex size-10 shrink-0 items-center justify-center rounded-pill bg-surface text-pine shadow-icirc";
  return (
    <MobileShell className="bg-paper">
      <div className="flex items-center gap-2.5 px-gutter-onboarding pt-0.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Go back"
            className={chevron}
          >
            <ChevronLeft className="size-[18px]" />
          </button>
        ) : (
          <Link href={backHref} aria-label="Go back" className={chevron}>
            <ChevronLeft className="size-[18px]" />
          </Link>
        )}
        {/* Frame 08's `.ob-dots`, not a numbered stepper. The step names survive as the
            nav's aria-label so a screen-reader user still hears "Step 2 of 3: Hours". */}
        <ObDots
          steps={[...WIZARD_STEPS]}
          current={current}
          className="flex-1"
        />
        {/* Balances the back button so the dots stay centred, as the frame has them. */}
        <span aria-hidden className="size-10 shrink-0" />
      </div>
      {children}
    </MobileShell>
  );
}

/**
 * Frame 08's verified-identity chip: `gchip live` with a shield, the signed-in name and
 * a tick. It exists to tell the user the account they just proved by OTP is the one this
 * clinic will belong to — so it renders the REAL session name or nothing at all.
 */
export function VerifiedIdentityChip() {
  const name = useAuth((s) => s.user?.name);
  if (!name) return null;
  return (
    <Chip tone="live" className="self-start">
      <ShieldCheck className="size-3" />
      {name} ✓
    </Chip>
  );
}

/**
 * Frame 08's defaults card, pinned to the bottom of the step: an eyebrow over the
 * settings the wizard ships without asking. Radius 20, padding 13/15, per the frame.
 *
 * The values are the seeded clinic defaults the API applies on create; they are listed
 * here so the user learns they exist and where to change them, which is the card's whole
 * job ("WE'VE SET THESE — CHANGE ANYTIME IN MORE").
 */
export function WizardDefaultsCard({ className }: { className?: string }) {
  return (
    <Card className={`rounded-[20px] px-[15px] py-[13px] ${className ?? ""}`}>
      <p className="text-[9.5px] font-heavy uppercase tracking-[0.08em] text-pine-3">
        We&apos;ve set these — change anytime in More
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Mini tone="neutral">9:30–20:30</Mini>
        <Mini tone="neutral">Lunch 13–14</Mini>
        <Mini tone="neutral">Sun off</Mini>
        <Mini tone="neutral">1 chair</Mini>
      </div>
    </Card>
  );
}
