import { describe, expect, it } from 'vitest';
import { formatDate, formatINR, formatTime } from './format';

describe('currency — Indian lakhs/crores grouping (§3.3)', () => {
  it('formats plain amounts and switches to lakh grouping at ₹1,00,000', () => {
    expect(formatINR(150000)).toBe('₹1,500');
    expect(formatINR(1500)).toBe('₹15');
    expect(formatINR(10_000_000)).toBe('₹1,00,000'); // one lakh
    expect(formatINR(1_23_45_678_00)).toBe('₹1,23,45,678'); // crores
    expect(formatINR(null)).toBe('—');
    expect(formatINR(0)).toBe('₹0');
  });
});

describe('time + date formats (§3.3)', () => {
  it('time is always hh:mm AM/PM in the clinic timezone', () => {
    // 04:30 UTC = 10:00 IST
    expect(formatTime('2026-07-16T04:30:00.000Z')).toMatch(/^10:00\sAM$/i);
    expect(formatTime('2026-07-16T11:45:00.000Z')).toMatch(/^5:15\sPM$/i);
  });

  it('near dates read "Mon 23 Jun"; far dates read "23 Jun 2026"', () => {
    const now = new Date('2026-06-20T00:00:00.000Z');
    expect(formatDate('2026-06-23T04:30:00.000Z', now)).toMatch(/^Tue,? 23 Jun$/);
    expect(formatDate('2027-06-23T04:30:00.000Z', now)).toMatch(/^23 Jun 2027$/);
  });
});
