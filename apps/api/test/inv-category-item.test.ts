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

async function makeCategory(doc: ClinicSetup, name = 'Consumables'): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/inventory/categories',
    headers: authHeader(doc.accessToken),
    payload: { name, iconName: 'box', sortOrder: 0 },
  });
  if (res.statusCode !== 201) throw new Error(`category create failed: ${res.body}`);
  return res.json().data.id;
}

const itemPayload = (categoryId: string, over: Record<string, unknown> = {}) => ({
  categoryId,
  name: 'Composite resin A2',
  unitOfMeasure: 'piece',
  reorderLevel: 5,
  ...over,
});

describe('Inventory category CRUD', () => {
  it('creates and lists categories sorted by sortOrder', async () => {
    const doc = await createDoctorWithClinic(app);
    await makeCategory(doc, 'Anaesthetics');
    await app.inject({
      method: 'POST',
      url: '/inventory/categories',
      headers: authHeader(doc.accessToken),
      payload: { name: 'Consumables', sortOrder: 0 },
    });
    const list = await app.inject({ method: 'GET', url: '/inventory/categories', headers: authHeader(doc.accessToken) });
    const names = list.json().data.items.map((c: { name: string }) => c.name);
    expect(names).toContain('Consumables');
    expect(names).toContain('Anaesthetics');
  });

  it('admin edits a category', async () => {
    const doc = await createDoctorWithClinic(app); // creator is ADMIN of own clinic
    const id = await makeCategory(doc);
    const res = await app.inject({
      method: 'PATCH',
      url: `/inventory/categories/${id}`,
      headers: authHeader(doc.accessToken),
      payload: { name: 'Consumables (Renamed)', sortOrder: 5 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Consumables (Renamed)');
  });

  it('archives a category without deleting its items', async () => {
    const doc = await createDoctorWithClinic(app);
    const catId = await makeCategory(doc);
    const item = await app.inject({
      method: 'POST',
      url: '/inventory/items',
      headers: authHeader(doc.accessToken),
      payload: itemPayload(catId),
    });
    const itemId = item.json().data.id;
    const del = await app.inject({ method: 'DELETE', url: `/inventory/categories/${catId}`, headers: authHeader(doc.accessToken) });
    expect(del.statusCode).toBe(200);
    // Item still exists.
    const got = await app.inject({ method: 'GET', url: `/inventory/items/${itemId}`, headers: authHeader(doc.accessToken) });
    expect(got.statusCode).toBe(200);
  });
});

describe('Inventory item CRUD', () => {
  it('creates an item with initial stock 0', async () => {
    const doc = await createDoctorWithClinic(app);
    const catId = await makeCategory(doc);
    const res = await app.inject({
      method: 'POST',
      url: '/inventory/items',
      headers: authHeader(doc.accessToken),
      payload: itemPayload(catId),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.currentStock).toBe(0);
    expect(res.json().data.categoryName).toBe('Consumables');
  });

  it('rejects an item with an unknown category (404)', async () => {
    const doc = await createDoctorWithClinic(app);
    const res = await app.inject({
      method: 'POST',
      url: '/inventory/items',
      headers: authHeader(doc.accessToken),
      payload: itemPayload('does-not-exist'),
    });
    expect(res.statusCode).toBe(404);
  });

  it('lists items and filters by category', async () => {
    const doc = await createDoctorWithClinic(app);
    const catA = await makeCategory(doc, 'Consumables');
    const catB = await makeCategory(doc, 'Instruments');
    await app.inject({ method: 'POST', url: '/inventory/items', headers: authHeader(doc.accessToken), payload: itemPayload(catA, { name: 'Gloves' }) });
    await app.inject({ method: 'POST', url: '/inventory/items', headers: authHeader(doc.accessToken), payload: itemPayload(catB, { name: 'Probe' }) });
    const filtered = await app.inject({ method: 'GET', url: `/inventory/items?category=${catB}`, headers: authHeader(doc.accessToken) });
    const names = filtered.json().data.items.map((i: { name: string }) => i.name);
    expect(names).toContain('Probe');
    expect(names).not.toContain('Gloves');
  });

  it('searches items by name', async () => {
    const doc = await createDoctorWithClinic(app);
    const catId = await makeCategory(doc);
    await app.inject({ method: 'POST', url: '/inventory/items', headers: authHeader(doc.accessToken), payload: itemPayload(catId, { name: 'Lignocaine carpule' }) });
    const res = await app.inject({ method: 'GET', url: '/inventory/items?search=ligno', headers: authHeader(doc.accessToken) });
    expect(res.json().data.items.some((i: { name: string }) => i.name === 'Lignocaine carpule')).toBe(true);
  });

  it('edits item metadata but never stock', async () => {
    const doc = await createDoctorWithClinic(app);
    const catId = await makeCategory(doc);
    const created = await app.inject({ method: 'POST', url: '/inventory/items', headers: authHeader(doc.accessToken), payload: itemPayload(catId) });
    const itemId = created.json().data.id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/inventory/items/${itemId}`,
      headers: authHeader(doc.accessToken),
      payload: { reorderLevel: 12, sku: 'COMP-A2' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.reorderLevel).toBe(12);
    expect(res.json().data.sku).toBe('COMP-A2');
    expect(res.json().data.currentStock).toBe(0);
  });
});
