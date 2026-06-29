import { describe, expect, it } from 'vitest';
import { previewSeries } from './recurring-preview';
import { procedureTone, durationLabel, appointmentSubtitle } from './format';

describe('previewSeries', () => {
  it('previews weekly target dates', () => {
    const rows = previewSeries({ firstDateISO: '2026-06-25', interval: 'WEEKLY', totalOccurrences: 4 });
    expect(rows.map((r) => r.dateISO)).toEqual(['2026-06-25', '2026-07-02', '2026-07-09', '2026-07-16']);
    expect(rows.map((r) => r.index)).toEqual([1, 2, 3, 4]);
  });

  it('previews biweekly and monthly', () => {
    expect(previewSeries({ firstDateISO: '2026-06-25', interval: 'BIWEEKLY', totalOccurrences: 2 }).map((r) => r.dateISO)).toEqual([
      '2026-06-25',
      '2026-07-09',
    ]);
    expect(previewSeries({ firstDateISO: '2026-06-25', interval: 'MONTHLY', totalOccurrences: 3 }).map((r) => r.dateISO)).toEqual([
      '2026-06-25',
      '2026-07-25',
      '2026-08-25',
    ]);
  });
});

describe('format helpers', () => {
  it('maps procedures to tones', () => {
    expect(procedureTone('Cleaning')).toBe('sky');
    expect(procedureTone('New patient consult')).toBe('peach');
    expect(procedureTone('Ortho adjustment')).toBe('lavender');
    expect(procedureTone('RCT')).toBe('sage');
    expect(procedureTone(null)).toBe('sage');
  });

  it('formats durations', () => {
    expect(durationLabel(30)).toBe('30m');
    expect(durationLabel(60)).toBe('1h');
    expect(durationLabel(90)).toBe('1h 30m');
  });

  it('builds an appointment subtitle with sitting info', () => {
    expect(appointmentSubtitle({ procedureHint: 'RCT', seriesIndex: 3, seriesTotal: 4, sittingNumber: null })).toBe('RCT · Sitting 3 of 4');
    expect(appointmentSubtitle({ procedureHint: 'Filling', seriesIndex: null, seriesTotal: null, sittingNumber: null })).toBe('Filling');
  });
});
