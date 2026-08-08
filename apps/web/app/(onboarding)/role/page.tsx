"use client";

import { useRouter } from "next/navigation";
import { Stethoscope, UserCheck } from "lucide-react";
import { MobileShell } from "@/components/mobile-shell";
import { AnimatedPage } from "@/components/animated-page";
import { ChoiceCard } from "@/components/onboarding/choice-card";
import { MascotMoment } from "@/components/illustrations";
import { useOnboarding } from "@/lib/onboarding-store";

/**
 * Frame 07. The `.ob` layout with `.rolec` option cards.
 *
 * The spec's copy carries a promise worth keeping: "Sets your home screen — you can
 * hold both roles later." That is what frame 77's Switch role delivers, so the line
 * is not marketing, it is a commitment the product actually honours.
 */
export default function RolePage() {
  const router = useRouter();
  const setRole = useOnboarding((s) => s.setRole);

  const pick = (role: "DOCTOR" | "RECEPTIONIST") => {
    setRole(role);
    router.push(role === "DOCTOR" ? "/clinic-choice" : "/clinic-join");
  };

  return (
    <MobileShell className="bg-paper">
      <AnimatedPage className="flex flex-1 flex-col px-gutter-onboarding">
        <div className="flex flex-col items-center pt-6">
          <MascotMoment
            pose="thinking"
            size="md"
            animation="float"
            background="cream"
          />
        </div>

        <div className="mt-7">
          <h1 className="text-question font-heavy leading-[1.15] tracking-tight text-pine">
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
            onClick={() => pick("DOCTOR")}
          />
          <ChoiceCard
            icon={<UserCheck />}
            accent="bg-sky-soft text-sky"
            title="I'm at the front desk"
            subtitle="Queue, appointments, payments, WhatsApp"
            onClick={() => pick("RECEPTIONIST")}
          />
        </div>
      </AnimatedPage>
    </MobileShell>
  );
}
