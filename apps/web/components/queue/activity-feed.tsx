'use client';

import { useEffect, useState } from 'react';
import { useQueueStore } from '@/lib/queue/store';
import { activityTone, relativeTime } from '@/lib/queue/activity-format';
import { EmptyState } from '@/components/ds';
import { Activity } from 'lucide-react';
import { cn } from '@/lib/utils';

const TONE_DOT: Record<ReturnType<typeof activityTone>, string> = {
  lime: 'bg-lime',
  sage: 'bg-sage',
  peach: 'bg-peach',
  sky: 'bg-sky',
  danger: 'bg-danger',
  neutral: 'bg-border',
};

/** Live activity feed — seeded from GET /activity, prepended by live `activity` events. */
export function ActivityFeed() {
  const activity = useQueueStore((s) => s.state.activity);
  // Re-render the relative timestamps every 30s without touching the store.
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (activity.length === 0) {
    return (
      <EmptyState
        variant="inline"
        icon={<Activity />}
        iconTone="sage"
        title="No activity yet"
        body="Check-ins, call-ins and checkouts show up here as they happen."
      />
    );
  }

  return (
    <ul className="space-y-2">
      {activity.map((a) => (
        <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-elev-1">
          <span className={cn('size-2 shrink-0 rounded-pill', TONE_DOT[activityTone(a.type)])} />
          <span className="flex-1 truncate text-sm text-ink">{a.text}</span>
          <span className="shrink-0 text-xs text-text-subtle">{relativeTime(a.createdAt)}</span>
        </li>
      ))}
    </ul>
  );
}
