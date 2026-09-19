import { describe, expect, it } from 'vitest';
import type { HistoryEntry } from '@odovox/types';
import { entryFacts, groupHistory } from './history-view';

const e = (over: Partial<HistoryEntry>): HistoryEntry => ({
  id: 'x', kind: 'visit', at: new Date('2026-07-13T04:00:00Z'), title: 'RCT',
  teeth: [], feePaise: null, doctorName: null, confirmed: false,
  prescriptionCount: 0, detail: null, ...over,
});

describe('groupHistory', () => {
  it('groups by month, newest first', () => {
    const g = groupHistory([
      e({ id: 'a', at: new Date('2026-03-14T04:00:00Z') }),
      e({ id: 'b', at: new Date('2026-07-13T04:00:00Z') }),
    ]);
    expect(g.map((x) => x.label)).toEqual(['JULY 2026', 'MARCH 2026']);
  });

  it('keeps entries within a month together', () => {
    const g = groupHistory([
      e({ id: 'a', at: new Date('2026-07-02T04:00:00Z') }),
      e({ id: 'b', at: new Date('2026-07-13T04:00:00Z') }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]!.entries.map((x) => x.id)).toEqual(['b', 'a']);
  });

  it('pins an undated fact to the end, in its own group', () => {
    // An allergy has no timestamp. Dropping it would remove the one entry that constrains
    // every prescription after it; dating it would invent a year.
    const g = groupHistory([
      e({ id: 'fact', kind: 'fact', at: null }),
      e({ id: 'visit', at: new Date('2026-07-13T04:00:00Z') }),
    ]);
    expect(g[g.length - 1]!.label).toBeNull();
    expect(g[g.length - 1]!.entries[0]!.id).toBe('fact');
  });

  it('handles an empty history', () => {
    expect(groupHistory([])).toEqual([]);
  });
});

describe('entryFacts', () => {
  it('lists only what exists', () => {
    expect(entryFacts(e({ teeth: [36], feePaise: 300_000, doctorName: 'Dr. Asha' })))
      .toEqual(['36', '₹3,000', 'Dr. Asha']);
    expect(entryFacts(e({}))).toEqual([]);
  });

  it('counts prescriptions when there are any', () => {
    expect(entryFacts(e({ prescriptionCount: 2 }))).toEqual(['2 Rx']);
    expect(entryFacts(e({ prescriptionCount: 0 }))).toEqual([]);
  });
});
