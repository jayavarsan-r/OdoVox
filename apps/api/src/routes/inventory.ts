import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  AdjustInput,
  ConsumeInput,
  CreateInventoryCategoryInput,
  CreateInventoryItemInput,
  DisposeExpiredInput,
  ListInventoryItemsQuery,
  ListMovementsQuery,
  PurchaseInput,
  UpdateInventoryCategoryInput,
  UpdateInventoryItemInput,
  type MovementKind,
} from '@odovox/types';
import { NotFoundError, UnprocessableError } from '../lib/errors.js';
import { ok, parse } from '../lib/http.js';
import { requireAdmin, requireRole } from '../lib/rbac.js';
import { broadcastToClinic } from '../lib/realtime/broadcast.js';
import {
  ITEM_INCLUDE,
  isLowStock,
  toCategoryResponse,
  toItemResponse,
  toItemSummary,
  toMovementResponse,
} from '../lib/inventory/serialize.js';

export async function inventoryRoutes(fastify: FastifyInstance): Promise<void> {
  const { prisma } = fastify;
  const anyRole = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'RECEPTIONIST', 'ADMIN')] };
  const doctorAdmin = { preHandler: [fastify.authenticate, requireRole('DOCTOR', 'ADMIN')] };
  const adminOnly = { preHandler: [fastify.authenticate, requireAdmin()] };

  async function loadItemOr404(clinicId: string, id: string) {
    const item = await prisma.inventoryItem.findFirst({ where: { id, clinicId }, include: ITEM_INCLUDE });
    if (!item) throw new NotFoundError('Inventory item not found');
    return item;
  }

  /** Reload the item, broadcast inventory.item.updated, and fire a low-stock alert on a downward crossing. */
  async function broadcastItem(clinicId: string, id: string, prevStock: number | null) {
    const item = await prisma.inventoryItem.findFirstOrThrow({ where: { id, clinicId }, include: ITEM_INCLUDE });
    const summary = toItemSummary(item);
    broadcastToClinic(clinicId, { type: 'inventory.item.updated', payload: summary });
    const crossedDown =
      prevStock !== null &&
      !isLowStock(prevStock, item.reorderLevel) &&
      isLowStock(item.currentStock, item.reorderLevel);
    if (crossedDown) {
      broadcastToClinic(clinicId, {
        type: 'inventory.low_stock_alert',
        payload: {
          itemId: item.id,
          itemName: item.name,
          currentStock: item.currentStock,
          reorderLevel: item.reorderLevel,
        },
      });
    }
    return summary;
  }

  // ===========================================================================
  // Categories
  // ===========================================================================

  fastify.get('/inventory/categories', anyRole, async (req) => {
    const rows = await prisma.inventoryCategory.findMany({
      where: { clinicId: req.clinicId! },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { items: true } } },
    });
    return ok({ items: rows.map(toCategoryResponse) });
  });

  fastify.post('/inventory/categories', doctorAdmin, async (req, reply) => {
    const body = parse(CreateInventoryCategoryInput, req.body);
    const row = await prisma.inventoryCategory.create({
      data: {
        clinicId: req.clinicId!,
        name: body.name,
        iconName: body.iconName ?? null,
        sortOrder: body.sortOrder,
        createdById: req.user!.id,
      },
    });
    await fastify.audit('INVENTORY_CATEGORY_CREATED', 'InventoryCategory', row.id, { name: body.name });
    reply.status(201);
    return ok(toCategoryResponse(row));
  });

  fastify.patch('/inventory/categories/:id', adminOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(UpdateInventoryCategoryInput, req.body);
    const existing = await prisma.inventoryCategory.findFirst({ where: { id, clinicId: req.clinicId! } });
    if (!existing) throw new NotFoundError('Category not found');
    const row = await prisma.inventoryCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.iconName !== undefined ? { iconName: body.iconName } : {}),
        ...(body.sortOrder !== undefined ? { sortOrder: body.sortOrder } : {}),
        ...(body.isArchived !== undefined ? { isArchived: body.isArchived } : {}),
      },
    });
    await fastify.audit('INVENTORY_CATEGORY_UPDATED', 'InventoryCategory', id, {});
    return ok(toCategoryResponse(row));
  });

  fastify.delete('/inventory/categories/:id', adminOnly, async (req) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.inventoryCategory.findFirst({ where: { id, clinicId: req.clinicId! } });
    if (!existing) throw new NotFoundError('Category not found');
    await prisma.inventoryCategory.update({ where: { id }, data: { isArchived: true } });
    await fastify.audit('INVENTORY_CATEGORY_ARCHIVED', 'InventoryCategory', id);
    return ok({ archived: true });
  });

  // ===========================================================================
  // Items
  // ===========================================================================

  fastify.get('/inventory/items', anyRole, async (req) => {
    const q = parse(ListInventoryItemsQuery, req.query);
    const clinicId = req.clinicId!;
    const where: Record<string, unknown> = { clinicId, isArchived: false };
    if (q.category) where.categoryId = q.category;
    if (q.search) where.name = { contains: q.search, mode: 'insensitive' };
    const rows = await prisma.inventoryItem.findMany({
      where,
      include: ITEM_INCLUDE,
      orderBy: { name: 'asc' },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    let items = rows.slice(0, q.limit).map(toItemSummary);
    // lowStockOnly is a post-filter (the index can't express currentStock < reorderLevel directly).
    if (q.lowStockOnly) items = items.filter((i) => i.isLowStock);
    return ok({ items, nextCursor: hasMore ? rows[q.limit - 1]!.id : null });
  });

  fastify.post('/inventory/items', doctorAdmin, async (req, reply) => {
    const body = parse(CreateInventoryItemInput, req.body);
    const clinicId = req.clinicId!;
    const category = await prisma.inventoryCategory.findFirst({ where: { id: body.categoryId, clinicId } });
    if (!category) throw new NotFoundError('Category not found');
    const item = await prisma.inventoryItem.create({
      data: {
        clinicId,
        categoryId: body.categoryId,
        name: body.name,
        sku: body.sku ?? null,
        unitOfMeasure: body.unitOfMeasure,
        currentStock: 0, // stock only ever changes via movements
        reorderLevel: body.reorderLevel,
        vendorName: body.vendorName ?? null,
        batchNumber: body.batchNumber ?? null,
        expiryDate: body.expiryDate ?? null,
        notes: body.notes ?? null,
        createdById: req.user!.id,
      },
      include: ITEM_INCLUDE,
    });
    await fastify.audit('INVENTORY_ITEM_CREATED', 'InventoryItem', item.id, { name: body.name });
    reply.status(201);
    return ok(toItemResponse(item));
  });

  fastify.get('/inventory/items/:id', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const item = await loadItemOr404(req.clinicId!, id);
    const movements = await prisma.inventoryMovement.findMany({
      where: { itemId: id, clinicId: req.clinicId! },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    return ok(toItemResponse(item, movements.map(toMovementResponse)));
  });

  fastify.patch('/inventory/items/:id', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(UpdateInventoryItemInput, req.body);
    const clinicId = req.clinicId!;
    await loadItemOr404(clinicId, id);
    if (body.categoryId) {
      const category = await prisma.inventoryCategory.findFirst({ where: { id: body.categoryId, clinicId } });
      if (!category) throw new NotFoundError('Category not found');
    }
    const item = await prisma.inventoryItem.update({
      where: { id },
      data: {
        ...(body.categoryId !== undefined ? { categoryId: body.categoryId } : {}),
        ...(body.name !== undefined ? { name: body.name } : {}),
        ...(body.sku !== undefined ? { sku: body.sku } : {}),
        ...(body.unitOfMeasure !== undefined ? { unitOfMeasure: body.unitOfMeasure } : {}),
        ...(body.reorderLevel !== undefined ? { reorderLevel: body.reorderLevel } : {}),
        ...(body.vendorName !== undefined ? { vendorName: body.vendorName } : {}),
        ...(body.batchNumber !== undefined ? { batchNumber: body.batchNumber } : {}),
        ...(body.expiryDate !== undefined ? { expiryDate: body.expiryDate } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
      },
      include: ITEM_INCLUDE,
    });
    await fastify.audit('INVENTORY_ITEM_UPDATED', 'InventoryItem', id, {});
    return ok(toItemResponse(item));
  });

  fastify.delete('/inventory/items/:id', adminOnly, async (req) => {
    const { id } = req.params as { id: string };
    await loadItemOr404(req.clinicId!, id);
    await prisma.inventoryItem.update({ where: { id }, data: { isArchived: true } });
    await fastify.audit('INVENTORY_ITEM_ARCHIVED', 'InventoryItem', id);
    return ok({ archived: true });
  });

  // ── Reports ─────────────────────────────────────────────────────────────────
  fastify.get('/inventory/low-stock', anyRole, async (req) => {
    const rows = await prisma.inventoryItem.findMany({
      where: { clinicId: req.clinicId!, isArchived: false },
      include: ITEM_INCLUDE,
    });
    const items = rows
      .filter((r) => isLowStock(r.currentStock, r.reorderLevel))
      .map((r) => ({
        itemId: r.id,
        itemName: r.name,
        currentStock: r.currentStock,
        reorderLevel: r.reorderLevel,
        deficit: r.reorderLevel - r.currentStock,
      }))
      .sort((a, b) => b.deficit - a.deficit);
    return ok({ items });
  });

  fastify.get('/inventory/expiring', anyRole, async (req) => {
    const days = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), req.query).days;
    const cutoff = new Date(Date.now() + days * 86_400_000);
    const rows = await prisma.inventoryItem.findMany({
      where: { clinicId: req.clinicId!, isArchived: false, expiryDate: { not: null, lte: cutoff } },
      include: ITEM_INCLUDE,
      orderBy: { expiryDate: 'asc' },
    });
    return ok({ items: rows.map(toItemSummary) });
  });

  // ===========================================================================
  // Movements (the only way stock changes)
  // ===========================================================================

  /** One transaction: write the movement + adjust item.currentStock. Returns prev/new stock. */
  async function applyMovement(
    clinicId: string,
    itemId: string,
    delta: number,
    movement: {
      kind: MovementKind;
      pricePerUnitPaise?: number | null;
      totalPricePaise?: number | null;
      visitId?: string | null;
      procedureName?: string | null;
      batchNumber?: string | null;
      expiryDate?: Date | null;
      reason?: string | null;
    },
    byUserId: string,
    itemUpdate: Record<string, unknown> = {},
  ): Promise<{ prevStock: number; newStock: number }> {
    return prisma.$transaction(async (tx) => {
      const current = await tx.inventoryItem.findFirstOrThrow({ where: { id: itemId, clinicId } });
      const prevStock = current.currentStock;
      const newStock = prevStock + delta;
      if (newStock < 0) {
        throw new UnprocessableError(
          `Only ${prevStock} in stock`,
          'INSUFFICIENT_STOCK',
          { itemId, currentStock: prevStock, requested: Math.abs(delta) },
        );
      }
      await tx.inventoryMovement.create({
        data: {
          clinicId,
          itemId,
          kind: movement.kind,
          quantity: delta,
          pricePerUnitPaise: movement.pricePerUnitPaise ?? null,
          totalPricePaise: movement.totalPricePaise ?? null,
          visitId: movement.visitId ?? null,
          procedureName: movement.procedureName ?? null,
          batchNumber: movement.batchNumber ?? null,
          expiryDate: movement.expiryDate ?? null,
          reason: movement.reason ?? null,
          byUserId,
        },
      });
      await tx.inventoryItem.update({
        where: { id: itemId },
        data: { currentStock: newStock, ...itemUpdate },
      });
      return { prevStock, newStock };
    });
  }

  fastify.post('/inventory/items/:id/purchase', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(PurchaseInput, req.body);
    const clinicId = req.clinicId!;
    await loadItemOr404(clinicId, id);
    const total = body.quantity * body.pricePerUnitPaise;
    const { prevStock } = await applyMovement(
      clinicId,
      id,
      body.quantity,
      {
        kind: 'PURCHASE',
        pricePerUnitPaise: body.pricePerUnitPaise,
        totalPricePaise: total,
        batchNumber: body.batchNumber ?? null,
        expiryDate: body.expiryDate ?? null,
        reason: body.notes ?? null,
      },
      req.user!.id,
      {
        lastPurchasePricePaise: body.pricePerUnitPaise,
        lastPurchaseDate: new Date(),
        ...(body.batchNumber ? { batchNumber: body.batchNumber } : {}),
        ...(body.expiryDate ? { expiryDate: body.expiryDate } : {}),
        ...(body.vendorName ? { vendorName: body.vendorName } : {}),
      },
    );
    await fastify.audit('INVENTORY_PURCHASE', 'InventoryItem', id, { quantity: body.quantity, totalPricePaise: total });
    const summary = await broadcastItem(clinicId, id, prevStock);
    return ok(summary);
  });

  fastify.post('/inventory/items/:id/consume', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(ConsumeInput, req.body);
    const clinicId = req.clinicId!;
    await loadItemOr404(clinicId, id);
    const { prevStock } = await applyMovement(
      clinicId,
      id,
      -body.quantity,
      { kind: 'CONSUMPTION', visitId: body.visitId ?? null, procedureName: body.procedureName ?? null, reason: body.notes ?? null },
      req.user!.id,
    );
    await fastify.audit('INVENTORY_CONSUME', 'InventoryItem', id, { quantity: body.quantity, visitId: body.visitId ?? null });
    const summary = await broadcastItem(clinicId, id, prevStock);
    return ok(summary);
  });

  fastify.post('/inventory/items/:id/adjust', adminOnly, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(AdjustInput, req.body);
    const clinicId = req.clinicId!;
    const item = await loadItemOr404(clinicId, id);
    const delta = body.newCount - item.currentStock;
    const { prevStock } = await applyMovement(
      clinicId,
      id,
      delta,
      { kind: 'ADJUSTMENT', reason: body.reason },
      req.user!.id,
    );
    await fastify.audit('INVENTORY_ADJUST', 'InventoryItem', id, { delta, reason: body.reason });
    const summary = await broadcastItem(clinicId, id, prevStock);
    return ok(summary);
  });

  fastify.post('/inventory/items/:id/dispose-expired', doctorAdmin, async (req) => {
    const { id } = req.params as { id: string };
    const body = parse(DisposeExpiredInput, req.body);
    const clinicId = req.clinicId!;
    await loadItemOr404(clinicId, id);
    const { prevStock } = await applyMovement(
      clinicId,
      id,
      -body.quantity,
      { kind: 'DISPOSAL_EXPIRED', reason: body.reason ?? 'Batch expired' },
      req.user!.id,
    );
    await fastify.audit('INVENTORY_DISPOSE_EXPIRED', 'InventoryItem', id, { quantity: body.quantity });
    const summary = await broadcastItem(clinicId, id, prevStock);
    return ok(summary);
  });

  fastify.get('/inventory/items/:id/movements', anyRole, async (req) => {
    const { id } = req.params as { id: string };
    const q = parse(ListMovementsQuery, req.query);
    const clinicId = req.clinicId!;
    await loadItemOr404(clinicId, id);
    const where: Record<string, unknown> = { clinicId, itemId: id };
    if (q.kind) where.kind = q.kind;
    if (q.from || q.to) {
      where.createdAt = { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) };
    }
    const rows = await prisma.inventoryMovement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: q.limit + 1,
      ...(q.cursor ? { cursor: { id: q.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > q.limit;
    const items = rows.slice(0, q.limit).map(toMovementResponse);
    return ok({ items, nextCursor: hasMore ? items[items.length - 1]!.id : null });
  });

  fastify.get('/inventory/movements/recent', anyRole, async (req) => {
    const rows = await prisma.inventoryMovement.findMany({
      where: { clinicId: req.clinicId! },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { item: { select: { name: true } } },
    });
    return ok({ items: rows.map(toMovementResponse) });
  });
}
