'use client';

import { useQueueStore } from '@/lib/queue/store';
import { statusIndicator } from '@/lib/realtime/status';
import { cn } from '@/lib/utils';

const DOT: Record<'lime' | 'amber' | 'danger', string> = {
  lime: 'bg-lime',
  amber: 'bg-warning',
  danger: 'bg-danger',
};

/** Small connection dot for a top bar — lime (live) / amber (reconnecting) / danger (offline). */
export function RealtimeDot({ className }: { className?: string }) {
  const status = useQueueStore((s) => s.status);
  const ind = statusIndicator(status);
  return (
    <span className={cn('inline-flex items-center', className)} role="status" aria-label={`Realtime: ${ind.label}`}>
      <span className={cn('size-2.5 rounded-pill', DOT[ind.tone], ind.live && 'animate-pulse')} />
    </span>
  );
}
