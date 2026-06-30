import type { InventoryItemSummary, MovementKind } from '@odovox/types';

export type StockTone = 'low' | 'near' | 'healthy' | 'archived';

/**
 * Left-bar tone for an item card (§5.1): red below reorder, amber when within 20% above reorder,
 * sage when healthy, gray when archived.
 */
export function stockTone(item: Pick<InventoryItemSummary, 'currentStock' | 'reorderLevel' | 'isArchived'>): StockTone {
  if (item.isArchived) return 'archived';
  if (item.reorderLevel > 0 && item.currentStock < item.reorderLevel) return 'low';
  if (item.reorderLevel > 0 && item.currentStock <= Math.ceil(item.reorderLevel * 1.2)) return 'near';
  return 'healthy';
}

export function stockBarClass(tone: StockTone): string {
  switch (tone) {
    case 'low':
      return 'bg-danger';
    case 'near':
      return 'bg-peach';
    case 'healthy':
      return 'bg-sage';
    case 'archived':
      return 'bg-border';
  }
}

/** Split a list into the low-stock section (rendered first, §5.1) and the rest. */
export function splitLowStock<T extends Pick<InventoryItemSummary, 'isLowStock'>>(items: T[]): { low: T[]; rest: T[] } {
  const low: T[] = [];
  const rest: T[] = [];
  for (const i of items) (i.isLowStock ? low : rest).push(i);
  return { low, rest };
}

/** "needs N more" copy for a low-stock row. */
export function reorderDeficitLabel(currentStock: number, reorderLevel: number): string {
  const deficit = Math.max(0, reorderLevel - currentStock);
  return `Reorder: needs ${deficit} more`;
}

const DAY_MS = 86_400_000;

/** An expiry chip is shown when the item expires within 90 days (§5.1). */
export function expiryWarning(expiryDate: Date | string | null, now: Date = new Date()): { label: string; expired: boolean } | null {
  if (!expiryDate) return null;
  const exp = new Date(expiryDate);
  const days = Math.floor((exp.getTime() - now.getTime()) / DAY_MS);
  if (days < 0) return { label: 'Expired', expired: true };
  if (days <= 90) {
    const mm = String(exp.getMonth() + 1).padStart(2, '0');
    return { label: `Exp ${mm}/${exp.getFullYear()}`, expired: false };
  }
  return null;
}

export const movementKindLabel: Record<MovementKind, string> = {
  PURCHASE: 'Purchase',
  CONSUMPTION: 'Consumption',
  ADJUSTMENT: 'Adjustment',
  DISPOSAL_EXPIRED: 'Disposal',
};

/** Signed-quantity display, e.g. +10 / -3. */
export function signedQuantity(quantity: number): string {
  return quantity > 0 ? `+${quantity}` : `${quantity}`;
}

/** Purchase sheet validation. */
export function validatePurchase(form: { quantity?: number; pricePerUnitPaise?: number }): {
  valid: boolean;
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  if (!form.quantity || form.quantity <= 0) errors.quantity = 'Enter a quantity';
  if (form.pricePerUnitPaise == null || form.pricePerUnitPaise < 0) errors.pricePerUnitPaise = 'Enter a price';
  return { valid: Object.keys(errors).length === 0, errors };
}

/** Consume guard — surfaces an error when the requested quantity exceeds stock on hand. */
export function consumeError(quantity: number, currentStock: number): string | null {
  if (!quantity || quantity <= 0) return 'Enter a quantity';
  if (quantity > currentStock) return `Only ${currentStock} in stock`;
  return null;
}

/** Adjust sheet requires a non-empty reason. */
export function adjustError(reason: string): string | null {
  return reason.trim().length === 0 ? 'A reason is required' : null;
}
