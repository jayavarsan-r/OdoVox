import { describe, expect, it } from 'vitest';
import { draftSubtotalPaise, lineSubtotalPaise } from './format';

describe('checkout sheet bill edit', () => {
  it('computes a line subtotal with quantity + line discount, floored at 0', () => {
    expect(lineSubtotalPaise({ quantity: 2, unitPricePaise: 50000, discountPaise: 20000 })).toBe(80000);
    expect(lineSubtotalPaise({ quantity: 1, unitPricePaise: 30000, discountPaise: 99999 })).toBe(0);
  });
  it('sums the draft items for a live preview', () => {
    expect(draftSubtotalPaise([
      { quantity: 1, unitPricePaise: 900000 },
      { quantity: 2, unitPricePaise: 50000, discountPaise: 20000 },
    ])).toBe(980000);
  });
});
