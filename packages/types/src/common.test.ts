import { describe, expect, it } from 'vitest';
import { FdiToothNumber, IndianPhone, PaiseAmount, Pagination } from './common.js';

describe('FdiToothNumber', () => {
  it('accepts valid FDI permanent teeth (11-48)', () => {
    for (const n of [11, 18, 21, 28, 31, 38, 41, 48, 25]) {
      expect(FdiToothNumber.safeParse(n).success).toBe(true);
    }
  });

  it('rejects out-of-range or malformed tooth numbers', () => {
    for (const n of [0, 9, 10, 19, 49, 50, 88, -11, 100]) {
      expect(FdiToothNumber.safeParse(n).success).toBe(false);
    }
  });

  it('rejects non-integers', () => {
    expect(FdiToothNumber.safeParse(11.5).success).toBe(false);
  });
});

describe('IndianPhone', () => {
  it('accepts 10-digit numbers starting 6-9', () => {
    expect(IndianPhone.safeParse('9876543210').success).toBe(true);
    expect(IndianPhone.safeParse('6000000000').success).toBe(true);
  });

  it('rejects bad phones', () => {
    for (const p of ['1234567890', '98765', '+919876543210', '5876543210', 'abcdefghij']) {
      expect(IndianPhone.safeParse(p).success).toBe(false);
    }
  });
});

describe('PaiseAmount', () => {
  it('accepts non-negative integers', () => {
    expect(PaiseAmount.safeParse(0).success).toBe(true);
    expect(PaiseAmount.safeParse(150000).success).toBe(true);
  });

  it('rejects floats and negatives', () => {
    expect(PaiseAmount.safeParse(10.5).success).toBe(false);
    expect(PaiseAmount.safeParse(-1).success).toBe(false);
  });
});

describe('Pagination', () => {
  it('defaults limit to 20', () => {
    const parsed = Pagination.parse({});
    expect(parsed.limit).toBe(20);
  });

  it('caps limit at 100', () => {
    expect(Pagination.safeParse({ limit: 101 }).success).toBe(false);
  });
});
