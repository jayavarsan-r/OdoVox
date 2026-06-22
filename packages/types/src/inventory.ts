import { z } from 'zod';
import { InventoryCategory, MovementType, Timestamps } from './common.js';

export const CreateInventoryItemInput = z.object({
  name: z.string().min(1).max(160),
  category: InventoryCategory,
  unit: z.string().min(1).max(40),
  currentStock: z.number().nonnegative().default(0),
  lowStockThreshold: z.number().nonnegative().default(0),
  trackExpiry: z.boolean().default(false),
  notes: z.string().max(2000).optional(),
});
export type CreateInventoryItemInput = z.infer<typeof CreateInventoryItemInput>;

export const UpdateInventoryItemInput = CreateInventoryItemInput.partial();
export type UpdateInventoryItemInput = z.infer<typeof UpdateInventoryItemInput>;

export const InventoryItemResponse = z
  .object({
    id: z.string(),
    clinicId: z.string(),
    name: z.string(),
    category: InventoryCategory,
    unit: z.string(),
    currentStock: z.number(),
    lowStockThreshold: z.number(),
    trackExpiry: z.boolean(),
    notes: z.string().nullable(),
  })
  .merge(Timestamps);
export type InventoryItemResponse = z.infer<typeof InventoryItemResponse>;

export const CreateInventoryMovementInput = z.object({
  itemId: z.string().min(1),
  type: MovementType,
  quantity: z.number().positive(),
  reason: z.string().max(500).optional(),
  batchNumber: z.string().max(120).optional(),
  expiryDate: z.coerce.date().optional(),
});
export type CreateInventoryMovementInput = z.infer<typeof CreateInventoryMovementInput>;

export const InventoryMovementResponse = z
  .object({
    id: z.string(),
    itemId: z.string(),
    type: MovementType,
    quantity: z.number(),
    reason: z.string().nullable(),
    batchNumber: z.string().nullable(),
    expiryDate: z.coerce.date().nullable(),
    createdById: z.string(),
  })
  .merge(Timestamps);
export type InventoryMovementResponse = z.infer<typeof InventoryMovementResponse>;
