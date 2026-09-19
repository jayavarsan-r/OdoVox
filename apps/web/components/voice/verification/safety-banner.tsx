'use client';

import { AlertTriangle, Check } from 'lucide-react';
import type { SafetyViewItem } from '@/lib/consult/safety-view';
import { cn } from '@/lib/utils';

/**
 * Safety warnings, which are never silently dismissable.
 *
 * A resolved warning re-renders struck through with a check — it does not disappear. That
 * is the invariant: the doctor can always see that a conflict existed and was dealt with,
 * because "the warning is gone" and "the warning was never raised" must not look alike.
 */
function SafetyCard({ item }: { item: SafetyViewItem }) {
  const blockingActive = item.blocking && !item.resolved;
  return (
    <div
      className={cn(
        'rounded-2xl p-3',
        item.resolved ? 'bg-sage-tint' : blockingActive ? 'bg-danger/10' : 'bg-warning-soft',
      )}
    >
      <div className="flex items-start gap-2">
        {item.resolved ? (
          <Check className="mt-0.5 size-4 shrink-0 text-sage-deep" />
        ) : (
          <AlertTriangle className={cn('mt-0.5 size-4 shrink-0', blockingActive ? 'text-danger' : 'text-warning')} />
        )}
        <p className={cn('text-[13px]', item.resolved ? 'text-sage-deep line-through' : 'text-ink')}>
          {item.message}
          {blockingActive ? ' (must fix before confirming)' : ''}
        </p>
      </div>
    </div>
  );
}

export function SafetyBanner({ safety }: { safety: SafetyViewItem[] }) {
  if (safety.length === 0) return null;
  return (
    <div className="mt-4 space-y-2">
      <p className="text-xs font-semibold tracking-widest text-text-subtle">
        SAFETY · {safety.filter((s) => !s.resolved).length}
      </p>
      {safety.map((item, i) => (
        <SafetyCard key={i} item={item} />
      ))}
    </div>
  );
}
