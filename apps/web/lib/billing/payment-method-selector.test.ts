import { describe, expect, it } from 'vitest';
import { CHECKOUT_METHODS, methodLabel } from './format';

describe('payment method selector', () => {
  it('offers Cash/UPI/Card/Razorpay (no Adjustment in the checkout sheet)', () => {
    expect(CHECKOUT_METHODS).toEqual(['CASH', 'UPI_MANUAL', 'CARD_MANUAL', 'RAZORPAY']);
    expect(CHECKOUT_METHODS).not.toContain('ADJUSTMENT');
  });
  it('labels methods for humans', () => {
    expect(methodLabel('UPI_MANUAL')).toBe('UPI');
    expect(methodLabel('RAZORPAY')).toBe('Razorpay link');
  });
});
