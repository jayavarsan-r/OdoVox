import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Schedule timeline pieces (v9 frames 46–49).
 *
 * The spec's rule for the day view is that empty time is INFORMATION: "Gaps and lunch
 * stay visible; state bars only (procedure = text)." So the free slot and the lunch
 * band are components in their own right, not absence.
 */

export type ApptState = "live" | "sky" | "neutral";

const BAR: Record<ApptState, string> = {
  live: "bg-live",
  sky: "bg-sky",
  neutral: "bg-hair-2",
};

/** `.appt` — absolutely positioned by the caller, which owns the time→pixel mapping. */
export interface AppointmentBlockProps {
  title: string;
  subtitle?: string;
  state?: ApptState;
  /** Completed appointments render at 50% (spec `.appt.done`). */
  done?: boolean;
  /** Status marker pinned top-right, e.g. a <Mini> reading "In chair". */
  marker?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}

export function AppointmentBlock({
  title,
  subtitle,
  state = "neutral",
  done = false,
  marker,
  onClick,
  style,
  className,
}: AppointmentBlockProps) {
  const body = (
    <>
      {/* `.appt::before` — the 3.5px state bar. State is colour; procedure is text. */}
      <span
        aria-hidden
        className={cn("absolute inset-y-0 left-0 w-[3.5px]", BAR[state])}
      />
      <span className="block text-body font-heavy leading-4 text-pine">
        {title}
      </span>
      {subtitle ? (
        <span className="mt-px block truncate text-3xs text-pine-2">
          {subtitle}
        </span>
      ) : null}
      {marker ? (
        <span className="absolute right-[9px] top-2">{marker}</span>
      ) : null}
    </>
  );

  const classes = cn(
    "absolute overflow-hidden rounded-sm bg-white py-2 pl-[13px] pr-2.5 text-left shadow-elev-1",
    done && "opacity-50",
    className,
  );

  if (!onClick)
    return (
      <div className={classes} style={style}>
        {body}
      </div>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        classes,
        "focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
      )}
    >
      {body}
    </button>
  );
}

/** `.slot-hint` — a bookable gap. Never rendered outside availability hours. */
export function SlotHint({
  label,
  onClick,
  style,
  className,
}: {
  label: string;
  onClick?: () => void;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      aria-label={`Book ${label}`}
      className={cn(
        "absolute flex items-center justify-center gap-[5px] rounded-sm border-[1.5px] border-dashed border-hair-2",
        "text-3xs font-semibold text-pine-3 transition-colors duration-press",
        "active:border-solid focus-visible:outline-none focus-visible:shadow-[var(--ring-lime)]",
        className,
      )}
    >
      <Plus className="size-[13px]" />
      {label}
    </button>
  );
}

/** `.lunch` — hatched, and it REJECTS drops (frame 49). */
export function LunchBand({
  label = "LUNCH",
  style,
  className,
}: {
  label?: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      style={style}
      className={cn(
        "absolute flex items-center justify-center rounded-md bg-hatch-lunch",
        "text-eyebrow font-heavy tracking-label text-pine-3",
        className,
      )}
    >
      {label}
    </div>
  );
}

/** `.nowline` — the current time, with a dot at its left end. */
export function NowLine({
  style,
  className,
}: {
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      style={style}
      className={cn(
        "absolute z-[5] h-0.5 rounded-px bg-lime shadow-[0_0_8px_var(--lime-glow)]",
        className,
      )}
    >
      <span className="absolute -top-[3px] left-0 size-2 rounded-pill bg-lime" />
    </div>
  );
}
