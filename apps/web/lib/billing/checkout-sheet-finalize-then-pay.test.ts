import { describe, expect, it } from 'vitest';
import { checkoutStep, canAddPayment } from './format';

describe('checkout sheet finalize then pay', () => {
  it('moves edit → pay → done across bill status', () => {
    expect(checkoutStep('DRAFT')).toBe('edit');
    expect(checkoutStep('FINALIZED')).toBe('pay');
    expect(checkoutStep('PARTIAL')).toBe('pay');
    expect(checkoutStep('PAID')).toBe('done');
  });
  it('only allows recording a payment once finalized', () => {
    expect(canAddPayment('DRAFT')).toBe(false);
    expect(canAddPayment('FINALIZED')).toBe(true);
    expect(canAddPayment('PARTIAL')).toBe(true);
    expect(canAddPayment('PAID')).toBe(false);
  });
});
