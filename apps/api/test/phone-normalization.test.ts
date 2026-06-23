import { describe, expect, it } from 'vitest';
import { maskPhone, normalizePhone } from '../src/lib/phone.js';

describe('normalizePhone', () => {
  it('strips +91, spaces and dashes', () => {
    expect(normalizePhone('+91 98765-43210')).toBe('9876543210');
  });

  it('drops a 91 country code prefix', () => {
    expect(normalizePhone('919876543210')).toBe('9876543210');
  });

  it('drops a leading 0 trunk prefix', () => {
    expect(normalizePhone('09876543210')).toBe('9876543210');
  });

  it('keeps a bare 10-digit number unchanged', () => {
    expect(normalizePhone('9876543210')).toBe('9876543210');
  });

  it('handles internal spaces', () => {
    expect(normalizePhone('98765 43210')).toBe('9876543210');
  });

  it('handles +91 with no space', () => {
    expect(normalizePhone('+919876543210')).toBe('9876543210');
  });

  it('strips parentheses and other punctuation', () => {
    expect(normalizePhone('(+91) 98765.43210')).toBe('9876543210');
  });
});

describe('maskPhone', () => {
  it('masks all but the last four digits', () => {
    expect(maskPhone('9876543210')).toBe('******3210');
  });

  it('normalizes before masking', () => {
    expect(maskPhone('+91 98765 43210')).toBe('******3210');
  });

  it('returns short input as-is', () => {
    expect(maskPhone('123')).toBe('123');
  });
});
