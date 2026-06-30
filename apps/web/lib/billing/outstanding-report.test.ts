import { describe, expect, it } from 'vitest';
import { sortOutstanding, daysSince } from './format';

describe('outstanding report', () => {
  it('sorts patients oldest outstanding first', () => {
    const rows = [
      { patientId: 'b', oldestBillDate: '2026-06-20' },
      { patientId: 'a', oldestBillDate: '2026-06-01' },
      { patientId: 'c', oldestBillDate: '2026-06-10' },
    ];
    expect(sortOutstanding(rows).map((r) => r.patientId)).toEqual(['a', 'c', 'b']);
  });
  it('computes whole days since a date', () => {
    const now = new Date('2026-06-30T12:00:00Z');
    expect(daysSince('2026-06-23T12:00:00Z', now)).toBe(7);
    expect(daysSince('2026-07-05T12:00:00Z', now)).toBe(0);
  });
});
