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

/** Slides in under the top bar when the socket is reconnecting/offline. */
export function OfflineBanner() {
  const status = useQueueStore((s) => s.status);
  const ind = statusIndicator(status);
  if (!ind.showBanner) return null;
  return (
    <div className="bg-warning-soft px-5 py-1.5 text-center text-xs font-medium text-ink">
      {ind.label}
    </div>
  );
}
