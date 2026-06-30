import { describe, expect, it } from 'vitest';
import { billStatusStyle, canRefund } from './format';

describe('bill detail page', () => {
  it('maps each status to a pill style + label', () => {
    expect(billStatusStyle('PAID').label).toBe('Paid');
    expect(billStatusStyle('PARTIAL').label).toBe('Partial');
    expect(billStatusStyle('FINALIZED').label).toBe('Unpaid');
    expect(billStatusStyle('CANCELLED').pill).toContain('line-through');
  });
  it('shows Refund only to an admin when a payment exists', () => {
    expect(canRefund({ paidPaise: 350000 }, true)).toBe(true);
    expect(canRefund({ paidPaise: 350000 }, false)).toBe(false);
    expect(canRefund({ paidPaise: 0 }, true)).toBe(false);
  });
});
