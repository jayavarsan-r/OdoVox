"use client";

import { cn } from "@/lib/utils";

export type ToothStatus =
  | "HEALTHY"
  | "CARIES"
  | "FILLED"
  | "EXTRACTED"
  | "CROWN"
  | "RCT"
  | "IMPLANT"
  | "MISSING"
  | "OTHER";

// FDI permanent dentition, laid out left→right as seen facing the patient.
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

/**
 * `.odn i` tones — corrected to the v9 legend (frame 40).
 *
 * The pre-migration map was INVERTED against the spec: RCT was lavender and Crown was
 * lime, which are each other's colours in v9. That matters beyond aesthetics — the
 * odontogram is the one screen where colour alone carries clinical state, and lime is
 * the app's "active / your turn" accent everywhere else. An active root canal is the
 * tooth that needs attention, so it takes lime plus the glow ring; a finished crown is
 * settled work, so it takes sky.
 *
 * Legend, per frame 40: RCT active · Crown · Caries · Missing ⬚
 */
export const TOOTH_TONE: Record<ToothStatus, string> = {
  HEALTHY: "bg-surface border-hair-2 text-pine-2",
  CARIES: "bg-warn-soft border-warn text-warn",
  FILLED: "bg-live-soft border-live text-live",
  EXTRACTED: "bg-surface border-hair-2 text-pine-3 line-through",
  CROWN: "bg-sky-soft border-sky text-sky",
  RCT: "bg-lime border-lime text-pine shadow-[0_0_0_2.5px_var(--lime-glow)]",
  IMPLANT: "bg-lav-soft border-lav text-lav",
  // Dashed ghost, still tappable — a missing tooth is a place you can record into.
  MISSING: "border-dashed border-hair-2 bg-transparent text-pine-3",
  OTHER: "bg-[rgba(31,42,35,0.05)] border-hair-2 text-pine-2",
};

export const TOOTH_STATUSES: ToothStatus[] = [
  "HEALTHY",
  "CARIES",
  "FILLED",
  "CROWN",
  "RCT",
  "IMPLANT",
  "EXTRACTED",
  "MISSING",
  "OTHER",
];

function Tooth({
  n,
  status,
  highlight,
  hasPlan,
  compact,
  onTap,
}: {
  n: number;
  status: ToothStatus;
  highlight?: boolean;
  hasPlan?: boolean;
  compact?: boolean;
  onTap?: (n: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onTap?.(n)}
      aria-label={`Tooth ${n}, ${status.toLowerCase()}${hasPlan ? ", active plan" : ""}`}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-md border font-mono transition-transform active:scale-90",
        compact ? "h-7 w-6 text-[9px]" : "h-9 w-7 text-[10px]",
        TOOTH_TONE[status],
        highlight && "ring-2 ring-ink ring-offset-1",
      )}
    >
      <span className="font-semibold">{n}</span>
      {/* Phase 5: active-plan indicator. */}
      {hasPlan ? (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-2 rounded-pill border border-surface bg-sage"
        />
      ) : null}
    </button>
  );
}

export function Odontogram({
  records,
  onToothTap,
  highlightTooth,
  activePlanTeeth,
  compact,
}: {
  records: Record<number, ToothStatus>;
  onToothTap?: (n: number) => void;
  highlightTooth?: number | null;
  /** Teeth with an active treatment plan — rendered with a sage dot (Phase 5). */
  activePlanTeeth?: number[];
  compact?: boolean;
}) {
  const planSet = new Set(activePlanTeeth ?? []);
  const row = (teeth: number[]) => (
    <div className="flex justify-center gap-0.5">
      {teeth.map((n) => (
        <Tooth
          key={n}
          n={n}
          status={records[n] ?? "HEALTHY"}
          highlight={highlightTooth === n}
          hasPlan={planSet.has(n)}
          compact={compact}
          onTap={onToothTap}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-1.5">
      {row(UPPER)}
      <div className="mx-auto h-px w-5/6 bg-border" />
      {row(LOWER)}
    </div>
  );
}

export function OdontogramLegend() {
  const items: { status: ToothStatus; label: string }[] = [
    { status: "CARIES", label: "Caries" },
    { status: "FILLED", label: "Filled" },
    { status: "CROWN", label: "Crown" },
    { status: "RCT", label: "RCT" },
    { status: "IMPLANT", label: "Implant" },
    { status: "EXTRACTED", label: "Extracted" },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {items.map((i) => (
        <span
          key={i.status}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          <span
            className={cn("size-3 rounded-sm border", TOOTH_TONE[i.status])}
          />
          {i.label}
        </span>
      ))}
    </div>
  );
}
