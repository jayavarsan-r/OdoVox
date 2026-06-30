import type { Prisma } from '@odovox/db';
import type {
  InventoryCategoryResponse,
  InventoryItemResponse,
  InventoryItemSummary,
  InventoryMovementResponse,
} from '@odovox/types';

/** An item is "low stock" when stock has fallen below its reorder level (reorderLevel 0 = never). */
export function isLowStock(currentStock: number, reorderLevel: number): boolean {
  return reorderLevel > 0 && currentStock < reorderLevel;
}

export const ITEM_INCLUDE = {
  category: { select: { name: true } },
} satisfies Prisma.InventoryItemInclude;

type ItemRow = Prisma.InventoryItemGetPayload<{ include: typeof ITEM_INCLUDE }>;

export function toItemSummary(row: ItemRow): InventoryItemSummary {
  return {
    id: row.id,
    clinicId: row.clinicId,
    categoryId: row.categoryId,
    categoryName: row.category?.name ?? null,
    name: row.name,
    unitOfMeasure: row.unitOfMeasure,
    currentStock: row.currentStock,
    reorderLevel: row.reorderLevel,
    isLowStock: isLowStock(row.currentStock, row.reorderLevel),
    expiryDate: row.expiryDate,
    isArchived: row.isArchived,
  };
}

export function toItemResponse(row: ItemRow, recentMovements?: InventoryMovementResponse[]): InventoryItemResponse {
  return {
    ...toItemSummary(row),
    sku: row.sku,
    vendorName: row.vendorName,
    lastPurchasePricePaise: row.lastPurchasePricePaise,
    lastPurchaseDate: row.lastPurchaseDate,
    batchNumber: row.batchNumber,
    notes: row.notes,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    ...(recentMovements ? { recentMovements } : {}),
  };
}

type MovementRow = Prisma.InventoryMovementGetPayload<object> & { item?: { name: string } };

export function toMovementResponse(row: MovementRow): InventoryMovementResponse {
  return {
    id: row.id,
    clinicId: row.clinicId,
    itemId: row.itemId,
    ...(row.item ? { itemName: row.item.name } : {}),
    kind: row.kind,
    quantity: row.quantity,
    pricePerUnitPaise: row.pricePerUnitPaise,
    totalPricePaise: row.totalPricePaise,
    visitId: row.visitId,
    procedureName: row.procedureName,
    batchNumber: row.batchNumber,
    expiryDate: row.expiryDate,
    reason: row.reason,
    byUserId: row.byUserId,
    createdAt: row.createdAt,
  };
}

type CategoryRow = Prisma.InventoryCategoryGetPayload<object> & { _count?: { items: number } };

export function toCategoryResponse(row: CategoryRow): InventoryCategoryResponse {
  return {
    id: row.id,
    clinicId: row.clinicId,
    name: row.name,
    iconName: row.iconName,
    sortOrder: row.sortOrder,
    isArchived: row.isArchived,
    ...(row._count ? { itemCount: row._count.items } : {}),
    createdById: row.createdById,
    createdAt: row.createdAt,
  };
}
