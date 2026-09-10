import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * `.vj` — the vertical sitting journey (v9 frame 38, patient Cases tab).
 *
 * Same grammar as the horizontal lab rail: done / now / ahead. A treatment plan reads
 * top-to-bottom because sittings are a sequence in time, where lab stages are a
 * pipeline — that is the only reason these are two components and not one.
 *
 * Spec: a 2px hair-2 spine at left 11px, inset 12px from the top and 14px from the
 * bottom so it never pokes out past the first and last nodes.
 */
export interface JourneySitting {
  id: string;
  title: string;
  /** "28 Jun · extirpation, dressing" or "Thu 16 Jul, 10:00 · booked" */
  subtitle?: string;
  state: "done" | "now" | "ahead";
  /** Node glyph for an ahead step — usually its sitting number. */
  short?: string;
  onClick?: () => void;
  /** Slot for the listening-Odo the spec shows at a live checkpoint. */
  trailing?: React.ReactNode;
}

export function VerticalJourney({
  sittings,
  className,
}: {
  sittings: JourneySitting[];
  className?: string;
}) {
  if (sittings.length === 0) return null;

  return (
    <div className={cn("relative py-0.5", className)}>
      <span
        aria-hidden
        className="absolute bottom-[14px] left-[11px] top-3 w-0.5 bg-hair-2"
      />
      <ol>
        {sittings.map((s) => {
          const body = (
            <>
              <span
                className={cn(
                  "relative z-[2] flex size-[22px] shrink-0 items-center justify-center rounded-pill border-2 text-micro font-heavy",
                  s.state === "done" && "border-live bg-live text-white",
                  s.state === "now" &&
                    "border-lime bg-lime text-pine shadow-[0_0_0_4px_var(--lime-glow)]",
                  s.state === "ahead" && "border-hair-2 bg-white text-pine-3",
                )}
              >
                {s.state === "done" ? <Check className="size-2.5" /> : s.short}
              </span>
              <span className="min-w-0 flex-1 pt-px text-left">
                <span className="block text-sm font-semibold text-pine">
                  {s.title}
                </span>
                {s.subtitle ? (
                  <span className="mt-0.5 block text-xs text-pine-2">
                    {s.subtitle}
                  </span>
                ) : null}
              </span>
              {s.trailing}
            </>
          );

          return (
            <li key={s.id} className="relative">
              {s.onClick ? (
                <button
                  type="button"
                  onClick={s.onClick}
                  className="flex w-full items-start gap-[13px] py-2 focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]"
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-start gap-[13px] py-2">{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
