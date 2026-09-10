import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `.jy` — the horizontal journey rail (v9 frame 58, lab case stages).
 *
 * Sent · Confirm · Prod · Ready · Recvd · Fitted. The same grammar as the vertical
 * sitting journey (frame 38) — one shape for "where is this in its lifecycle",
 * whichever object it belongs to.
 *
 * Spec: 22px nodes, 2px hair-2 border; done = live fill; now = lime fill with a 4px
 * lime-glow halo. The connector runs behind at left/right 9%, filled to the current step.
 */
export interface JourneyStep {
  label: string;
  /** Shown inside the node when not done — usually its 1-based position. */
  short?: string;
}

export interface JourneyRailProps {
  steps: JourneyStep[];
  /** Zero-based index of the current step. Everything before it is done. */
  current: number;
  className?: string;
}

export function JourneyRail({ steps, current, className }: JourneyRailProps) {
  if (steps.length === 0) return null;
  const safeCurrent = Math.min(Math.max(current, 0), steps.length - 1);
  // The connector fills to the CURRENT node's centre, not past it.
  const fillPct =
    steps.length > 1 ? (safeCurrent / (steps.length - 1)) * 100 : 0;

  return (
    <div
      className={cn("relative mt-3 flex items-start", className)}
      role="img"
      aria-label={`Step ${safeCurrent + 1} of ${steps.length}: ${steps[safeCurrent]!.label}`}
    >
      {/* `.jyline` — sits behind the nodes */}
      <span
        aria-hidden
        className="absolute left-[9%] right-[9%] top-[10px] z-0 h-0.5 bg-hair-2"
      >
        <span
          className="block h-full bg-live"
          style={{ width: `${fillPct}%` }}
        />
      </span>

      {steps.map((step, i) => {
        const done = i < safeCurrent;
        const now = i === safeCurrent;
        return (
          <div
            key={step.label}
            className="relative z-[2] flex flex-1 flex-col items-center gap-[5px]"
          >
            <span
              className={cn(
                "flex size-[22px] items-center justify-center rounded-pill border-2 text-micro font-heavy",
                done && "border-live bg-live text-white",
                now &&
                  "border-lime bg-lime text-pine shadow-[0_0_0_4px_var(--lime-glow)]",
                !done && !now && "border-hair-2 bg-white text-pine-3",
              )}
            >
              {done ? <Check className="size-2.5" /> : (step.short ?? i + 1)}
            </span>
            <span className="text-center text-label font-semibold leading-[1.25] text-pine-2">
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
