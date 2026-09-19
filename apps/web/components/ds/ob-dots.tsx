"use client";

import { stepperStates, type StepDef } from "@/lib/ds/stepper";
import { cn } from "@/lib/utils";

/**
 * The spec's `.ob-dots` — the onboarding progress indicator, measured:
 *
 *   .ob-dots      display:flex; gap:6px; justify-content:center; padding:6px 0 0
 *   .ob-dots i    6x6, radius 3, background var(--hair-2)
 *   .ob-dots i.on width:18px, background var(--pine)
 *
 * Frames 02 and 08 both use it. It replaced a numbered stepper that carried visible step
 * labels ("1 Clinic — 2 Hours — 3 Profile"), so the labels move to `aria-label` rather
 * than disappearing: the dots are decorative to sighted users and the position is still
 * announced. Matching the frame must not cost a screen-reader user the step name.
 */
export function ObDots({
  steps,
  current,
  className,
}: {
  steps: StepDef[];
  current: string;
  className?: string;
}) {
  const states = stepperStates(steps, current);
  const active = states.find((s) => s.status === "current");

  return (
    <nav
      aria-label={
        active
          ? `Step ${active.index + 1} of ${states.length}: ${active.label}`
          : "Progress"
      }
      className={cn("flex justify-center gap-1.5 pt-1.5", className)}
    >
      {states.map((step) => (
        <span
          key={step.id}
          aria-hidden
          className={cn(
            "h-1.5 rounded-sm transition-[width,background-color] duration-state",
            step.status === "upcoming" ? "w-1.5 bg-hair-2" : "w-[18px] bg-pine",
          )}
        />
      ))}
    </nav>
  );
}
