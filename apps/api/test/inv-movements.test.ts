import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, type ClinicSetup } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function setupItem(doc: ClinicSetup, over: Record<string, unknown> = {}): Promise<string> {
  const cat = await app.inject({
    method: 'POST',
    url: '/inventory/categories',
    headers: authHeader(doc.accessToken),
    payload: { name: `Cat-${Math.random().toString(36).slice(2, 8)}` },
  });
  const item = await app.inject({
    method: 'POST',
    url: '/inventory/items',
    headers: authHeader(doc.accessToken),
    payload: { categoryId: cat.json().data.id, name: 'Item', unitOfMeasure: 'piece', reorderLevel: 5, ...over },
  });
  return item.json().data.id;
}

const post = (doc: ClinicSetup, url: string, payload: unknown) =>
  app.inject({ method: 'POST', url, headers: authHeader(doc.accessToken), payload });

describe('Inventory purchase', () => {
  it('increments stock and updates last-purchase fields', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    const res = await post(doc, `/inventory/items/${id}/purchase`, { quantity: 30, pricePerUnitPaise: 1200, batchNumber: 'B-1' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.currentStock).toBe(30);
    const detail = await app.inject({ method: 'GET', url: `/inventory/items/${id}`, headers: authHeader(doc.accessToken) });
    expect(detail.json().data.lastPurchasePricePaise).toBe(1200);
    expect(detail.json().data.batchNumber).toBe('B-1');
  });

  it('records a movement with denormalized total price', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    await post(doc, `/inventory/items/${id}/purchase`, { quantity: 10, pricePerUnitPaise: 450 });
    const hist = await app.inject({ method: 'GET', url: `/inventory/items/${id}/movements`, headers: authHeader(doc.accessToken) });
    const m = hist.json().data.items[0];
    expect(m.kind).toBe('PURCHASE');
    expect(m.quantity).toBe(10);
    expect(m.totalPricePaise).toBe(4500);
  });
});

describe('Inventory consume', () => {
  it('decrements stock', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    await post(doc, `/inventory/items/${id}/purchase`, { quantity: 20, pricePerUnitPaise: 100 });
    const res = await post(doc, `/inventory/items/${id}/consume`, { quantity: 5, procedureName: 'RCT' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.currentStock).toBe(15);
  });

  it('returns 422 INSUFFICIENT_STOCK when consuming more than on hand', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    await post(doc, `/inventory/items/${id}/purchase`, { quantity: 3, pricePerUnitPaise: 100 });
    const res = await post(doc, `/inventory/items/${id}/consume`, { quantity: 10 });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('INSUFFICIENT_STOCK');
    expect(res.json().error.details.currentStock).toBe(3);
  });
});

describe('Inventory adjust', () => {
  it('writes an ADJUSTMENT for the delta and sets the new count', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    await post(doc, `/inventory/items/${id}/purchase`, { quantity: 10, pricePerUnitPaise: 100 });
    const res = await post(doc, `/inventory/items/${id}/adjust`, { newCount: 7, reason: 'Stock count correction' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.currentStock).toBe(7);
    const hist = await app.inject({ method: 'GET', url: `/inventory/items/${id}/movements?kind=ADJUSTMENT`, headers: authHeader(doc.accessToken) });
    expect(hist.json().data.items[0].quantity).toBe(-3);
  });

  it('requires a reason (400 without one)', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    const res = await post(doc, `/inventory/items/${id}/adjust`, { newCount: 5 });
    expect(res.statusCode).toBe(400);
  });
});

describe('Inventory dispose-expired', () => {
  it('writes a DISPOSAL_EXPIRED movement and decrements stock', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    await post(doc, `/inventory/items/${id}/purchase`, { quantity: 12, pricePerUnitPaise: 100 });
    const res = await post(doc, `/inventory/items/${id}/dispose-expired`, { quantity: 4, reason: 'Past expiry' });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.currentStock).toBe(8);
    const hist = await app.inject({ method: 'GET', url: `/inventory/items/${id}/movements?kind=DISPOSAL_EXPIRED`, headers: authHeader(doc.accessToken) });
    expect(hist.json().data.items[0].quantity).toBe(-4);
  });
});

describe('Inventory low-stock', () => {
  it('lists items below reorder level sorted by deficit', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc, { reorderLevel: 5 });
    await post(doc, `/inventory/items/${id}/purchase`, { quantity: 2, pricePerUnitPaise: 100 }); // 2 < 5 → low
    const res = await app.inject({ method: 'GET', url: '/inventory/low-stock', headers: authHeader(doc.accessToken) });
    const row = res.json().data.items.find((i: { itemId: string }) => i.itemId === id);
    expect(row).toBeTruthy();
    expect(row.deficit).toBe(3);
  });

  it('aggregates movement history per item', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    await post(doc, `/inventory/items/${id}/purchase`, { quantity: 10, pricePerUnitPaise: 100 });
    await post(doc, `/inventory/items/${id}/consume`, { quantity: 2 });
    const hist = await app.inject({ method: 'GET', url: `/inventory/items/${id}/movements`, headers: authHeader(doc.accessToken) });
    expect(hist.json().data.items.length).toBe(2);
  });
});
