'use client';

import { cn } from '@/lib/utils';

export type ToothStatus =
  | 'HEALTHY'
  | 'CARIES'
  | 'FILLED'
  | 'EXTRACTED'
  | 'CROWN'
  | 'RCT'
  | 'IMPLANT'
  | 'MISSING'
  | 'OTHER';

// FDI permanent dentition, laid out left→right as seen facing the patient.
const UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

export const TOOTH_TONE: Record<ToothStatus, string> = {
  HEALTHY: 'bg-surface border-border text-ink',
  CARIES: 'bg-peach border-peach text-ink',
  FILLED: 'bg-sage border-sage text-ink',
  EXTRACTED: 'bg-surface border-border text-text-subtle line-through',
  CROWN: 'bg-lime border-lime text-ink',
  RCT: 'bg-lavender border-lavender text-ink',
  IMPLANT: 'bg-sky border-sky text-ink',
  MISSING: 'bg-surface border-border text-text-subtle opacity-40',
  OTHER: 'bg-muted border-border-strong text-ink',
};

export const TOOTH_STATUSES: ToothStatus[] = [
  'HEALTHY',
  'CARIES',
  'FILLED',
  'CROWN',
  'RCT',
  'IMPLANT',
  'EXTRACTED',
  'MISSING',
  'OTHER',
];

function Tooth({
  n,
  status,
  highlight,
  compact,
  onTap,
}: {
  n: number;
  status: ToothStatus;
  highlight?: boolean;
  compact?: boolean;
  onTap?: (n: number) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onTap?.(n)}
      aria-label={`Tooth ${n}, ${status.toLowerCase()}`}
      className={cn(
        'flex flex-col items-center justify-center rounded-md border font-mono transition-transform active:scale-90',
        compact ? 'h-7 w-6 text-[9px]' : 'h-9 w-7 text-[10px]',
        TOOTH_TONE[status],
        highlight && 'ring-2 ring-ink ring-offset-1',
      )}
    >
      <span className="font-semibold">{n}</span>
    </button>
  );
}

export function Odontogram({
  records,
  onToothTap,
  highlightTooth,
  compact,
}: {
  records: Record<number, ToothStatus>;
  onToothTap?: (n: number) => void;
  highlightTooth?: number | null;
  compact?: boolean;
}) {
  const row = (teeth: number[]) => (
    <div className="flex justify-center gap-0.5">
      {teeth.map((n) => (
        <Tooth
          key={n}
          n={n}
          status={records[n] ?? 'HEALTHY'}
          highlight={highlightTooth === n}
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
    { status: 'CARIES', label: 'Caries' },
    { status: 'FILLED', label: 'Filled' },
    { status: 'CROWN', label: 'Crown' },
    { status: 'RCT', label: 'RCT' },
    { status: 'IMPLANT', label: 'Implant' },
    { status: 'EXTRACTED', label: 'Extracted' },
  ];
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1.5">
      {items.map((i) => (
        <span key={i.status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={cn('size-3 rounded-sm border', TOOTH_TONE[i.status])} />
          {i.label}
        </span>
      ))}
    </div>
  );
}
