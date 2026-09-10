import { cn } from "@/lib/utils";
import { ringDashArray } from "@/lib/ds/ring";

/**
 * `.ringwrap` — the SVG progress ring with a centred label. v9 uses it for sitting
 * progress (2/3) on the Home hero and the patient overview, and for day progress
 * (3/8) on the chair-free Flow state.
 *
 * Spec: track `#E9EDDD`, rotated -90° so it fills from 12 o'clock, round line caps.
 * Lime = treatment progress · sky = day progress.
 */
export interface ProgressRingProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  tone?: "lime" | "sky" | "live";
  /** Big centred figure. Defaults to `value/max`. */
  label?: string;
  /** Small uppercase caption under the figure, e.g. "TODAY" or "SITTING". */
  caption?: string;
  className?: string;
}

const STROKE: Record<NonNullable<ProgressRingProps["tone"]>, string> = {
  lime: "var(--lime)",
  sky: "var(--sky)",
  live: "var(--live)",
};

export function ProgressRing({
  value,
  max,
  size = 56,
  strokeWidth = 6,
  tone = "lime",
  label,
  caption,
  className,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const { dash, gap } = ringDashArray(value, max, radius);
  const centre = size / 2;

  return (
    <div
      className={cn("relative shrink-0", className)}
      role="img"
      aria-label={`${value} of ${max}${caption ? ` ${caption.toLowerCase()}` : ""}`}
    >
      <svg width={size} height={size} className="block -rotate-90">
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke="#E9EDDD"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          fill="none"
          stroke={STROKE[tone]}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <b className="text-[19px] font-heavy leading-none tabular-nums text-pine">
          {label ?? `${value}/${max}`}
        </b>
        {caption ? (
          <span className="mt-0.5 text-label font-heavy tracking-eyebrow text-pine-3">
            {caption}
          </span>
        ) : null}
      </div>
    </div>
  );
}
