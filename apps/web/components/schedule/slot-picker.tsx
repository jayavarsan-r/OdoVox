'use client';

import type { Slot } from '@odovox/types';
import { cn } from '@/lib/utils';
import { formatLocalTime } from '@/lib/schedule/tz';

/** Horizontal strip of available slot chips (§7.3 live availability preview). */
export function SlotPicker({
  slots,
  tz,
  selectedISO,
  loading,
  onPick,
}: {
  slots: Slot[];
  tz: string;
  selectedISO: string | null;
  loading?: boolean;
  onPick: (startsAt: Date) => void;
}) {
  if (loading) return <p className="text-xs text-text-subtle">Loading availability…</p>;
  if (slots.length === 0) return <p className="text-xs text-text-subtle">No free slots that day — try another date.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {slots.map((s) => {
        const start = new Date(s.startsAt);
        const iso = start.toISOString();
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onPick(start)}
            className={cn(
              'rounded-pill border px-3 py-1.5 text-xs font-medium tabular-nums transition-colors',
              selectedISO === iso ? 'border-lime bg-lime text-ink' : 'border-border bg-paper-warm hover:bg-muted',
            )}
          >
            {formatLocalTime(start, tz)}
          </button>
        );
      })}
    </div>
  );
}
