import { describe, expect, it } from 'vitest';
import {
  adjustError,
  consumeError,
  expiryWarning,
  reorderDeficitLabel,
  signedQuantity,
  splitLowStock,
  stockBarClass,
  stockTone,
  validatePurchase,
} from './inventory-ui';

const item = (over: Partial<{ currentStock: number; reorderLevel: number; isArchived: boolean; isLowStock: boolean }> = {}) => ({
  currentStock: 10,
  reorderLevel: 5,
  isArchived: false,
  isLowStock: false,
  ...over,
});

describe('stockTone', () => {
  it('is low below reorder, near just above, healthy when ample', () => {
    expect(stockTone(item({ currentStock: 2, reorderLevel: 5 }))).toBe('low');
    expect(stockTone(item({ currentStock: 6, reorderLevel: 5 }))).toBe('near');
    expect(stockTone(item({ currentStock: 50, reorderLevel: 5 }))).toBe('healthy');
    expect(stockTone(item({ isArchived: true }))).toBe('archived');
  });
  it('maps tone to a bar class', () => {
    expect(stockBarClass('low')).toBe('bg-danger');
    expect(stockBarClass('healthy')).toBe('bg-sage');
  });
});

describe('splitLowStock', () => {
  it('separates the low-stock section from the rest', () => {
    const items = [item({ isLowStock: true }), item({ isLowStock: false }), item({ isLowStock: true })];
    const { low, rest } = splitLowStock(items);
    expect(low.length).toBe(2);
    expect(rest.length).toBe(1);
  });
});

describe('reorderDeficitLabel', () => {
  it('computes how many more are needed', () => {
    expect(reorderDeficitLabel(2, 5)).toBe('Reorder: needs 3 more');
    expect(reorderDeficitLabel(5, 5)).toBe('Reorder: needs 0 more');
  });
});

describe('expiryWarning', () => {
  const now = new Date('2026-06-30T00:00:00Z');
  it('warns within 90 days', () => {
    expect(expiryWarning(new Date('2026-08-01T00:00:00Z'), now)).toEqual({ label: 'Exp 08/2026', expired: false });
  });
  it('flags expired', () => {
    expect(expiryWarning(new Date('2026-06-01T00:00:00Z'), now)).toEqual({ label: 'Expired', expired: true });
  });
  it('is silent when far off or absent', () => {
    expect(expiryWarning(new Date('2027-06-01T00:00:00Z'), now)).toBeNull();
    expect(expiryWarning(null, now)).toBeNull();
  });
});

describe('movement display', () => {
  it('signs quantities', () => {
    expect(signedQuantity(10)).toBe('+10');
    expect(signedQuantity(-3)).toBe('-3');
  });
});

describe('sheet validation', () => {
  it('purchase requires quantity and price', () => {
    expect(validatePurchase({}).valid).toBe(false);
    expect(validatePurchase({ quantity: 5, pricePerUnitPaise: 100 }).valid).toBe(true);
  });
  it('consume errors when exceeding stock', () => {
    expect(consumeError(10, 3)).toBe('Only 3 in stock');
    expect(consumeError(2, 3)).toBeNull();
    expect(consumeError(0, 3)).toBe('Enter a quantity');
  });
  it('adjust requires a reason', () => {
    expect(adjustError('')).toBe('A reason is required');
    expect(adjustError('count')).toBeNull();
  });
});
