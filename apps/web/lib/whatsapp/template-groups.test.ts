import { describe, expect, it } from 'vitest';
import { lastSixMonths, maskPhone, templateGroups, timingOf } from './template-groups';

const t = (templateKey: string, isEnabled = true) => ({ templateKey, isEnabled });

/** The six templates the clinic actually has approved. */
const SEEDED = [
  t('appointment_reminder_1h'),
  t('appointment_reminder_24h'),
  t('lab_case_ready'),
  t('outstanding_balance_reminder'),
  t('payment_receipt'),
  t('prescription_ready'),
];

describe('templateGroups', () => {
  it('turns six Meta template keys into four decisions', () => {
    const groups = templateGroups(SEEDED);
    expect(groups.map((g) => g.label)).toEqual([
      'Appointment reminders',
      'Lab updates to patients',
      'Payment reminders',
      'Prescription ready',
    ]);
  });

  it('reads the timings longest-lead-time first', () => {
    // "24h + 1h" is how someone describes their reminder schedule. "1h + 24h" is how an
    // alphabetical sort describes it.
    const [appointments] = templateGroups(SEEDED);
    expect(appointments!.hint).toBe('24h + 1h');
  });

  it('omits the hint when there is only one timing to state', () => {
    const groups = templateGroups([t('lab_case_ready')]);
    expect(groups[0]!.hint).toBeUndefined();
  });

  it('collects both payment templates under one switch', () => {
    const payments = templateGroups(SEEDED).find((g) => g.id === 'payments')!;
    expect(payments.keys).toEqual(['outstanding_balance_reminder', 'payment_receipt']);
  });

  it('is ON when any member is on, so one tap turns the whole group off', () => {
    const groups = templateGroups([
      t('appointment_reminder_1h', false),
      t('appointment_reminder_24h', true),
    ]);
    expect(groups[0]!.enabled).toBe(true);
  });

  it('is OFF only when every member is off', () => {
    const groups = templateGroups([
      t('appointment_reminder_1h', false),
      t('appointment_reminder_24h', false),
    ]);
    expect(groups[0]!.enabled).toBe(false);
  });

  it('gives an unrecognised template its own row rather than dropping it', () => {
    // A template nobody can see is a message nobody knows is being sent to their patients.
    const groups = templateGroups([...SEEDED, t('review_request')]);
    const orphan = groups.find((g) => g.id === 'review_request');
    expect(orphan).toBeDefined();
    expect(orphan!.label).toBe('Review request');
  });

  it('skips a group entirely when the clinic has none of its templates', () => {
    const groups = templateGroups([t('lab_case_ready')]);
    expect(groups).toHaveLength(1);
  });
});

describe('timingOf', () => {
  it('reads hours and days off the key', () => {
    expect(timingOf('appointment_reminder_24h')).toBe('24h');
    expect(timingOf('followup_3d')).toBe('3d');
  });

  it('is null when the key carries no timing', () => {
    expect(timingOf('lab_case_ready')).toBeNull();
  });
});

describe('maskPhone', () => {
  it('masks the middle, keeping the country code and last four', () => {
    expect(maskPhone('+918000000000')).toBe('+91 80····0000');
  });

  it('handles a number stored without a country code', () => {
    expect(maskPhone('9876543210')).toBe('98····3210');
  });

  it('returns null when there is no number rather than a masked nothing', () => {
    expect(maskPhone(null)).toBeNull();
    expect(maskPhone(undefined)).toBeNull();
  });

  it('leaves something too short to mask alone', () => {
    expect(maskPhone('12345')).toBe('12345');
  });
});

describe('lastSixMonths', () => {
  const now = new Date(2026, 8, 9); // 9 Sep 2026

  it('always returns six points, oldest first', () => {
    const out = lastSixMonths([], now);
    expect(out).toHaveLength(6);
    expect(out.map((c) => c.month)).toEqual([4, 5, 6, 7, 8, 9]);
  });

  it('keeps a month that has spend and zero-fills the rest', () => {
    // One real month used to render as a single bar across the whole chart — a lone data
    // point drawn as though it were a trend.
    const out = lastSixMonths([{ year: 2026, month: 8, totalCostPaise: 620_00 }], now);
    expect(out.find((c) => c.month === 8)!.totalCostPaise).toBe(620_00);
    expect(out.filter((c) => c.totalCostPaise === 0)).toHaveLength(5);
  });

  it('crosses a year boundary', () => {
    const out = lastSixMonths([], new Date(2026, 1, 15)); // Feb 2026
    expect(out.map((c) => `${c.year}-${c.month}`)).toEqual([
      '2025-9',
      '2025-10',
      '2025-11',
      '2025-12',
      '2026-1',
      '2026-2',
    ]);
  });

  it('ignores history outside the window rather than squeezing it in', () => {
    const out = lastSixMonths([{ year: 2025, month: 1, totalCostPaise: 999 }], now);
    expect(out.every((c) => c.totalCostPaise === 0)).toBe(true);
  });
});
