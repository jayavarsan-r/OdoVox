'use client';

import { cn } from '@/lib/utils';

/**
 * Pointer-line label for image annotations (x-ray notes, photo callouts).
 * Built now for Phase 3+; positions are normalized 0–1 within the parent.
 * See design-system.md §6.
 */
type Pt = { x: number; y: number };

export function AnnotationCallout({
  label,
  position,
  pointTo,
  className,
}: {
  label: string;
  position: Pt;
  pointTo: Pt;
  className?: string;
}) {
  const pct = (n: number) => `${Math.min(1, Math.max(0, n)) * 100}%`;
  return (
    <div aria-hidden className={cn('pointer-events-none absolute inset-0', className)}>
      <svg className="absolute inset-0 size-full overflow-visible" aria-hidden>
        <line
          x1={pct(position.x)}
          y1={pct(position.y)}
          x2={pct(pointTo.x)}
          y2={pct(pointTo.y)}
          className="stroke-ink"
          strokeWidth={1}
          strokeDasharray="2 3"
        />
        <circle cx={pct(pointTo.x)} cy={pct(pointTo.y)} r={3} className="fill-lime stroke-ink" strokeWidth={1} />
      </svg>
      <span
        className="absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-pill bg-ink px-2.5 py-1 text-[11px] font-medium text-paper shadow-elev-2"
        style={{ left: pct(position.x), top: pct(position.y) }}
      >
        {label}
      </span>
    </div>
  );
}
