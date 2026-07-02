import type { InventoryItemMatch } from '@odovox/types';

/**
 * Phase 9.7 W1.2 — pure apply-plan builders for the inventory voice verification cards. The
 * dictate endpoints return extraction rows (+ server fuzzy matches); the sheets edit them; these
 * functions turn the final rows into the exact sequence of existing mutation calls to make.
 * Pure + tested; the sheets just execute the plan.
 */

export interface PurchaseRow {
  name: string;
  quantity: number;
  unitPricePaise: number | null;
  batchNumber: string | null;
  expiryDate: string | null;
  vendorName: string | null;
  match: InventoryItemMatch | null;
  /** Card decision for an unmatched row: create as new item under this category, or skip. */
  createCategoryId?: string | null;
  skipped?: boolean;
}

export interface ConsumeRow {
  name: string;
  quantity: number;
  match: InventoryItemMatch | null;
  insufficientStock?: boolean;
  skipped?: boolean;
}

export interface AdjustRow {
  name: string;
  newCount: number;
  match: InventoryItemMatch | null;
  skipped?: boolean;
}

export type PurchaseStep =
  | { kind: 'create-item'; name: string; categoryId: string; quantity: number; unitPricePaise: number; vendorName: string | null; batchNumber: string | null; expiryDate: string | null }
  | { kind: 'purchase'; itemId: string; itemName: string; quantity: number; unitPricePaise: number; vendorName: string | null; batchNumber: string | null; expiryDate: string | null };

/**
 * Matched rows purchase directly; unmatched rows with a chosen category create-then-purchase.
 * Rows without a price can't post (PurchaseInput requires pricePerUnitPaise) — they're returned
 * in `blocked` so the card asks for the price instead of silently dropping them.
 */
export function buildPurchaseApplyPlan(rows: PurchaseRow[]): { steps: PurchaseStep[]; blocked: string[] } {
  const steps: PurchaseStep[] = [];
  const blocked: string[] = [];
  for (const row of rows) {
    if (row.skipped) continue;
    if (row.unitPricePaise === null) {
      blocked.push(row.name);
      continue;
    }
    const common = {
      quantity: row.quantity,
      unitPricePaise: row.unitPricePaise,
      vendorName: row.vendorName,
      batchNumber: row.batchNumber,
      expiryDate: row.expiryDate,
    };
    if (row.match) {
      steps.push({ kind: 'purchase', itemId: row.match.itemId, itemName: row.match.name, ...common });
    } else if (row.createCategoryId) {
      steps.push({ kind: 'create-item', name: row.name, categoryId: row.createCategoryId, ...common });
    } else {
      blocked.push(row.name); // unmatched with no create decision — card must resolve
    }
  }
  return { steps, blocked };
}

export interface ConsumeStep {
  itemId: string;
  itemName: string;
  quantity: number;
}

/** Only matched rows with enough stock apply; the rest stay on the card as blockers. */
export function buildConsumeApplyPlan(rows: ConsumeRow[]): { steps: ConsumeStep[]; blocked: string[] } {
  const steps: ConsumeStep[] = [];
  const blocked: string[] = [];
  for (const row of rows) {
    if (row.skipped) continue;
    if (!row.match) {
      blocked.push(row.name);
      continue;
    }
    if (row.match.currentStock < row.quantity) {
      blocked.push(`${row.name} (only ${row.match.currentStock} in stock)`);
      continue;
    }
    steps.push({ itemId: row.match.itemId, itemName: row.match.name, quantity: row.quantity });
  }
  return { steps, blocked };
}

export interface AdjustStep {
  itemId: string;
  itemName: string;
  newCount: number;
}

export function buildAdjustApplyPlan(rows: AdjustRow[]): { steps: AdjustStep[]; blocked: string[] } {
  const steps: AdjustStep[] = [];
  const blocked: string[] = [];
  for (const row of rows) {
    if (row.skipped) continue;
    if (!row.match) {
      blocked.push(row.name);
      continue;
    }
    steps.push({ itemId: row.match.itemId, itemName: row.match.name, newCount: row.newCount });
  }
  return { steps, blocked };
}
