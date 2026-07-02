import { describe, expect, it } from 'vitest';
import { buildAdjustApplyPlan, buildConsumeApplyPlan, buildPurchaseApplyPlan } from './inventory-voice';

const match = (itemId: string, name: string, currentStock = 100) => ({
  itemId,
  name,
  unitOfMeasure: 'box',
  currentStock,
  score: 0.9,
});

describe('inventory voice apply plans (Phase 9.7 W1.2)', () => {
  it('purchase: matched rows buy directly, unmatched with a category create-then-purchase', () => {
    const { steps, blocked } = buildPurchaseApplyPlan([
      { name: 'gloves', quantity: 5, unitPricePaise: 20000, batchNumber: null, expiryDate: null, vendorName: 'Meditrade', match: match('i1', 'Latex Gloves') },
      { name: 'apex locator', quantity: 1, unitPricePaise: 1500000, batchNumber: null, expiryDate: null, vendorName: null, match: null, createCategoryId: 'cat1' },
      { name: 'mystery', quantity: 1, unitPricePaise: null, batchNumber: null, expiryDate: null, vendorName: null, match: match('i2', 'Mystery') },
      { name: 'skipped', quantity: 9, unitPricePaise: 100, batchNumber: null, expiryDate: null, vendorName: null, match: null, skipped: true },
    ]);
    expect(steps).toEqual([
      expect.objectContaining({ kind: 'purchase', itemId: 'i1', quantity: 5, unitPricePaise: 20000 }),
      expect.objectContaining({ kind: 'create-item', name: 'apex locator', categoryId: 'cat1' }),
    ]);
    expect(blocked).toEqual(['mystery']); // no price → card must ask, never silently drop
  });

  it('consume: blocks unmatched rows and rows that would push stock below zero', () => {
    const { steps, blocked } = buildConsumeApplyPlan([
      { name: 'gloves', quantity: 5, match: match('i1', 'Gloves', 50) },
      { name: 'carpules', quantity: 4, match: match('i2', 'Carpules', 1) },
      { name: 'unknown thing', quantity: 2, match: null },
    ]);
    expect(steps).toEqual([{ itemId: 'i1', itemName: 'Gloves', quantity: 5 }]);
    expect(blocked).toEqual(['carpules (only 1 in stock)', 'unknown thing']);
  });

  it('adjust: absolute counts apply only to matched items', () => {
    const { steps, blocked } = buildAdjustApplyPlan([
      { name: 'gloves', newCount: 40, match: match('i1', 'Gloves') },
      { name: 'ghost item', newCount: 3, match: null },
    ]);
    expect(steps).toEqual([{ itemId: 'i1', itemName: 'Gloves', newCount: 40 }]);
    expect(blocked).toEqual(['ghost item']);
  });
});
