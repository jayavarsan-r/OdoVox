import type { QueueEventType } from '@odovox/types';

/** Compact relative time for the activity feed ("just now", "2m ago", "1h ago", "3d ago"). */
export function relativeTime(date: Date | string, now: number = Date.now()): string {
  const then = new Date(date).getTime();
  const secs = Math.max(0, Math.round((now - then) / 1000));
  if (secs < 45) return 'just now';
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

/** Dot tone per event type — lime for forward motion, sage for clinical, peach for billing, etc. */
export function activityTone(type: QueueEventType): 'lime' | 'sage' | 'peach' | 'sky' | 'danger' | 'neutral' {
  switch (type) {
    case 'CHECKED_IN':
      return 'sky';
    case 'CALLED_IN':
    case 'DOCTOR_RECORDING':
      return 'lime';
    case 'CHECKOUT_STARTED':
    case 'COMPLETED':
      return 'peach';
    case 'RETURNED_TO_QUEUE':
    case 'REASSIGNED':
    case 'PRIORITY_CHANGED':
      return 'sage';
    case 'CANCELLED':
      return 'danger';
    default:
      return 'neutral';
  }
}
