import { describe, expect, it } from 'vitest';
import { activityTone, relativeTime } from './activity-format';

describe('activity formatting', () => {
  const now = new Date('2026-06-24T12:00:00Z').getTime();

  it('formats relative time compactly', () => {
    expect(relativeTime(new Date('2026-06-24T11:59:40Z'), now)).toBe('just now');
    expect(relativeTime(new Date('2026-06-24T11:58:00Z'), now)).toBe('2m ago');
    expect(relativeTime(new Date('2026-06-24T10:00:00Z'), now)).toBe('2h ago');
    expect(relativeTime(new Date('2026-06-21T12:00:00Z'), now)).toBe('3d ago');
  });

  it('maps event types to a dot tone', () => {
    expect(activityTone('CHECKED_IN')).toBe('sky');
    expect(activityTone('CALLED_IN')).toBe('lime');
    expect(activityTone('COMPLETED')).toBe('peach');
    expect(activityTone('CANCELLED')).toBe('danger');
    expect(activityTone('REASSIGNED')).toBe('sage');
  });
});
