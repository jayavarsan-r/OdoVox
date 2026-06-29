'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildWeekStrip, shiftFocus } from '@/lib/schedule/week-strip';

const LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function headerLabel(focusISO: string, todayISO: string): string {
  const p = focusISO.split('-');
  const y = Number(p[0]);
  const m = Number(p[1]);
  const d = Number(p[2]);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const base = `${LONG[dow]} ${d} ${MON[m - 1]}`;
  return focusISO === todayISO ? `${base} · Today` : base;
}

export function WeekStrip({
  focusISO,
  todayISO,
  weeklyOffDays,
  onFocus,
}: {
  focusISO: string;
  todayISO: string;
  weeklyOffDays: number[];
  onFocus: (iso: string) => void;
}) {
  const days = buildWeekStrip({ focusISO, todayISO, weeklyOffDays });
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button type="button" aria-label="Previous day" onClick={() => onFocus(shiftFocus(focusISO, 'prev-day'))} className="flex size-8 items-center justify-center rounded-pill hover:bg-muted">
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-sm font-semibold">{headerLabel(focusISO, todayISO)}</span>
        <button type="button" aria-label="Next day" onClick={() => onFocus(shiftFocus(focusISO, 'next-day'))} className="flex size-8 items-center justify-center rounded-pill hover:bg-muted">
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-1">
        {days.map((d) => (
          <button
            key={d.iso}
            type="button"
            onClick={() => onFocus(d.iso)}
            className={cn(
              'flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl border text-center transition-colors',
              d.isFocus ? 'border-lime bg-lime text-ink' : 'border-border bg-paper-warm',
              d.isOffDay && !d.isFocus && 'opacity-50',
            )}
          >
            <span className="text-[10px] font-medium uppercase text-text-subtle">{d.letter}</span>
            <span className={cn('text-sm font-semibold tabular-nums', d.isToday && !d.isFocus && 'text-lime')}>{d.dayNum}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
