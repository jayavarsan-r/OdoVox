"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Stethoscope, UserCheck } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { AnimatedPage } from "@/components/animated-page";
import { ChoiceCard } from "@/components/onboarding/choice-card";
import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/onboarding-store";

type Choice = "DOCTOR" | "RECEPTIONIST";

const LABEL: Record<Choice, string> = {
  DOCTOR: "Continue as doctor",
  RECEPTIONIST: "Continue as front desk",
};

/**
 * Frame 07 — rebuilt against the rendered reference, not against memory.
 *
 * Two deviations were shipped here and caught by Gate B:
 *
 *  #11  a mascot the frame does not have. Removed. Frame 07 opens straight on the
 *       question; the mascot pushed the whole page down and changed its rhythm.
 *  #12  the page navigated on card tap. The frame is SELECT → sticky CTA
 *       ("Continue as doctor"), which is a different interaction model, not a visual
 *       tweak: it lets the user change their mind before committing, and it is why
 *       ChoiceCard has a `selected` prop at all.
 *
 * Both reverted to match the reference.
 */
export default function RolePage() {
  const router = useRouter();
  const setRole = useOnboarding((s) => s.setRole);
  const [choice, setChoice] = useState<Choice>("DOCTOR");

  const proceed = () => {
    setRole(choice);
    router.push(choice === "DOCTOR" ? "/clinic-choice" : "/clinic-join");
  };

  return (
    <MobileShell className="bg-paper">
      <AnimatedPage className="flex flex-1 flex-col px-gutter-onboarding">
        <div className="mt-7">
          <h1 className="text-question font-heavy leading-[1.15] tracking-question text-pine">
            How will you use Odovox?
          </h1>
          <p className="mt-2 text-sm leading-[1.5] text-pine-2">
            Sets your home screen — you can hold both roles later.
          </p>
        </div>

        <div className="mt-4 space-y-4">
          <ChoiceCard
            icon={<Stethoscope />}
            accent="bg-live-soft text-live"
            title="I'm a doctor"
            subtitle="Consultations, voice records, treatment plans"
            selected={choice === "DOCTOR"}
            onClick={() => setChoice("DOCTOR")}
          />
          <ChoiceCard
            icon={<UserCheck />}
            accent="bg-sky-soft text-sky"
            title="I'm at the front desk"
            subtitle="Queue, appointments, payments, WhatsApp"
            selected={choice === "RECEPTIONIST"}
            onClick={() => setChoice("RECEPTIONIST")}
          />
        </div>

        {/* `.sticky-cta` — the frame's commit step. */}
        <div className="mt-auto pb-[18px]">
          <Button size="lg" block onClick={proceed}>
            {LABEL[choice]}
          </Button>
        </div>
      </AnimatedPage>
    </MobileShell>
  );
}
