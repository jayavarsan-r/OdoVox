import { describe, expect, it } from 'vitest';
import { ageLabel, isStale } from './format';

const NOW = new Date('2026-07-13T12:00:00+05:30');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

describe('ageLabel', () => {
  it('says today and yesterday rather than counting to zero', () => {
    // The screen rendered "oldest 0 days ago" for a bill raised this morning, and
    // "oldest 1 days ago" for yesterday's.
    expect(ageLabel(daysAgo(0), NOW)).toBe('today');
    expect(ageLabel(daysAgo(1), NOW)).toBe('yesterday');
  });

  it('counts days inside the first week', () => {
    expect(ageLabel(daysAgo(3), NOW)).toBe('3 days');
    expect(ageLabel(daysAgo(6), NOW)).toBe('6 days');
  });

  it('switches to weeks, then months, as precision stops mattering', () => {
    // Nobody chasing a debt needs "23 days". They need "3 weeks".
    expect(ageLabel(daysAgo(7), NOW)).toBe('1 week');
    expect(ageLabel(daysAgo(23), NOW)).toBe('3 weeks');
    expect(ageLabel(daysAgo(31), NOW)).toBe('1 month');
    expect(ageLabel(daysAgo(70), NOW)).toBe('2 months');
  });

  it('never says a future bill is overdue', () => {
    expect(ageLabel(new Date(NOW.getTime() + 86_400_000), NOW)).toBe('today');
  });
});

describe('isStale', () => {
  it('turns at a fortnight — past that it is not an oversight', () => {
    expect(isStale(daysAgo(13), NOW)).toBe(false);
    expect(isStale(daysAgo(14), NOW)).toBe(true);
  });
});
