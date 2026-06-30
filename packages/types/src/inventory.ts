import { z } from 'zod';
import { MovementKind, PaiseAmount } from './common.js';

// STOCK CONVENTION: stock quantities are integers. For fractional units (e.g. 3.5 ml carpule)
// callers store the value × 1000 (3500). Whole-unit items store the count directly. This mirrors
// the DB (InventoryItem.currentStock is Int) — never send floats.

// ===========================================================================
// Categories
// ===========================================================================

export const CreateInventoryCategoryInput = z.object({
  name: z.string().min(1).max(80),
  iconName: z.string().max(60).optional(),
  sortOrder: z.number().int().min(0).max(9999).default(0),
});
export type CreateInventoryCategoryInput = z.infer<typeof CreateInventoryCategoryInput>;

export const UpdateInventoryCategoryInput = z.object({
  name: z.string().min(1).max(80).optional(),
  iconName: z.string().max(60).nullable().optional(),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  isArchived: z.boolean().optional(),
});
export type UpdateInventoryCategoryInput = z.infer<typeof UpdateInventoryCategoryInput>;

export const InventoryCategoryResponse = z.object({
  id: z.string(),
  clinicId: z.string(),
  name: z.string(),
  iconName: z.string().nullable(),
  sortOrder: z.number().int(),
  isArchived: z.boolean(),
  itemCount: z.number().int().optional(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
});
export type InventoryCategoryResponse = z.infer<typeof InventoryCategoryResponse>;

// ===========================================================================
// Items
// ===========================================================================

export const CreateInventoryItemInput = z.object({
  categoryId: z.string().min(1),
  name: z.string().min(1).max(160),
  sku: z.string().max(80).optional(),
  unitOfMeasure: z.string().min(1).max(40),
  reorderLevel: z.number().int().nonnegative().default(0),
  vendorName: z.string().max(160).optional(),
  batchNumber: z.string().max(120).optional(),
  expiryDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});
export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemInput>;

// Metadata only — stock changes happen exclusively through movements.
export const UpdateInventoryItemInput = z.object({
  categoryId: z.string().min(1).optional(),
  name: z.string().min(1).max(160).optional(),
  sku: z.string().max(80).nullable().optional(),
  unitOfMeasure: z.string().min(1).max(40).optional(),
  reorderLevel: z.number().int().nonnegative().optional(),
  vendorName: z.string().max(160).nullable().optional(),
  batchNumber: z.string().max(120).nullable().optional(),
  expiryDate: z.coerce.date().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
export type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemInput>;

export const ListInventoryItemsQuery = z.object({
  category: z.string().optional(), // categoryId
  search: z.string().max(120).optional(),
  lowStockOnly: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListInventoryItemsQuery = z.infer<typeof ListInventoryItemsQuery>;

export const InventoryItemSummary = z.object({
  id: z.string(),
  clinicId: z.string(),
  categoryId: z.string(),
  categoryName: z.string().nullable(),
  name: z.string(),
  unitOfMeasure: z.string(),
  currentStock: z.number().int(),
  reorderLevel: z.number().int(),
  isLowStock: z.boolean(),
  expiryDate: z.coerce.date().nullable(),
  isArchived: z.boolean(),
});
export type InventoryItemSummary = z.infer<typeof InventoryItemSummary>;

export const InventoryItemResponse = InventoryItemSummary.extend({
  sku: z.string().nullable(),
  vendorName: z.string().nullable(),
  lastPurchasePricePaise: z.number().int().nullable(),
  lastPurchaseDate: z.coerce.date().nullable(),
  batchNumber: z.string().nullable(),
  notes: z.string().nullable(),
  createdById: z.string(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  recentMovements: z.array(z.lazy(() => InventoryMovementResponse)).optional(),
});
export type InventoryItemResponse = z.infer<typeof InventoryItemResponse>;

// ===========================================================================
// Movements
// ===========================================================================

export const PurchaseInput = z.object({
  quantity: z.number().int().positive(),
  pricePerUnitPaise: PaiseAmount,
  batchNumber: z.string().max(120).optional(),
  expiryDate: z.coerce.date().optional(),
  vendorName: z.string().max(160).optional(),
  notes: z.string().max(1000).optional(),
});
export type PurchaseInput = z.infer<typeof PurchaseInput>;

export const ConsumeInput = z.object({
  quantity: z.number().int().positive(),
  visitId: z.string().min(1).optional(),
  procedureName: z.string().max(160).optional(),
  notes: z.string().max(1000).optional(),
});
export type ConsumeInput = z.infer<typeof ConsumeInput>;

export const AdjustInput = z.object({
  newCount: z.number().int().nonnegative(),
  reason: z.string().min(1).max(1000),
});
export type AdjustInput = z.infer<typeof AdjustInput>;

export const DisposeExpiredInput = z.object({
  quantity: z.number().int().positive(),
  reason: z.string().max(1000).optional(),
});
export type DisposeExpiredInput = z.infer<typeof DisposeExpiredInput>;

export const ListMovementsQuery = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  kind: MovementKind.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListMovementsQuery = z.infer<typeof ListMovementsQuery>;

export const InventoryMovementResponse = z.object({
  id: z.string(),
  clinicId: z.string(),
  itemId: z.string(),
  itemName: z.string().optional(),
  kind: MovementKind,
  quantity: z.number().int(), // signed
  pricePerUnitPaise: z.number().int().nullable(),
  totalPricePaise: z.number().int().nullable(),
  visitId: z.string().nullable(),
  procedureName: z.string().nullable(),
  batchNumber: z.string().nullable(),
  expiryDate: z.coerce.date().nullable(),
  reason: z.string().nullable(),
  byUserId: z.string(),
  createdAt: z.coerce.date(),
});
export type InventoryMovementResponse = z.infer<typeof InventoryMovementResponse>;

export const LowStockItem = z.object({
  itemId: z.string(),
  itemName: z.string(),
  currentStock: z.number().int(),
  reorderLevel: z.number().int(),
  deficit: z.number().int(),
});
export type LowStockItem = z.infer<typeof LowStockItem>;
