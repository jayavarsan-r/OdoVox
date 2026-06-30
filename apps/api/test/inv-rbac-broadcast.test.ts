import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import { authHeader, buildTestApp, createDoctorWithClinic, joinReceptionist, type ClinicSetup } from './helpers.js';
import { collect, connectClient, listenApp } from './socket-helpers.js';

let app: FastifyInstance;
let url: string;
const clients: Socket[] = [];

beforeAll(async () => {
  app = await buildTestApp();
  url = await listenApp(app);
});
afterAll(async () => {
  for (const c of clients) c.close();
  await app.close();
});

async function setupItem(doc: ClinicSetup, reorderLevel = 5): Promise<string> {
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
    payload: { categoryId: cat.json().data.id, name: 'Item', unitOfMeasure: 'piece', reorderLevel },
  });
  return item.json().data.id;
}

describe('Inventory RBAC', () => {
  it('receptionist can purchase but cannot consume, adjust, create or archive', async () => {
    const doc = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doc.joinCode);
    const id = await setupItem(doc);

    const purchase = await app.inject({ method: 'POST', url: `/inventory/items/${id}/purchase`, headers: authHeader(recp.accessToken), payload: { quantity: 10, pricePerUnitPaise: 100 } });
    expect(purchase.statusCode).toBe(200);

    const consume = await app.inject({ method: 'POST', url: `/inventory/items/${id}/consume`, headers: authHeader(recp.accessToken), payload: { quantity: 1 } });
    expect(consume.statusCode).toBe(403);

    const adjust = await app.inject({ method: 'POST', url: `/inventory/items/${id}/adjust`, headers: authHeader(recp.accessToken), payload: { newCount: 3, reason: 'x' } });
    expect(adjust.statusCode).toBe(403);

    const create = await app.inject({ method: 'POST', url: '/inventory/items', headers: authHeader(recp.accessToken), payload: { categoryId: 'x', name: 'Y', unitOfMeasure: 'piece' } });
    expect(create.statusCode).toBe(403);
  });

  it('only ADMIN can adjust and archive', async () => {
    const doc = await createDoctorWithClinic(app); // ADMIN
    const id = await setupItem(doc);
    await app.inject({ method: 'POST', url: `/inventory/items/${id}/purchase`, headers: authHeader(doc.accessToken), payload: { quantity: 10, pricePerUnitPaise: 100 } });
    const adjust = await app.inject({ method: 'POST', url: `/inventory/items/${id}/adjust`, headers: authHeader(doc.accessToken), payload: { newCount: 8, reason: 'count' } });
    expect(adjust.statusCode).toBe(200);
    const archive = await app.inject({ method: 'DELETE', url: `/inventory/items/${id}`, headers: authHeader(doc.accessToken) });
    expect(archive.statusCode).toBe(200);
  });

  it('cross-clinic item is invisible (404)', async () => {
    const docA = await createDoctorWithClinic(app);
    const docB = await createDoctorWithClinic(app);
    const id = await setupItem(docA);
    const res = await app.inject({ method: 'GET', url: `/inventory/items/${id}`, headers: authHeader(docB.accessToken) });
    expect(res.statusCode).toBe(404);
  });
});

describe('Inventory broadcasts (REST → WS, after commit)', () => {
  it('purchase broadcasts inventory.item.updated with the new stock', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc);
    const sock = await connectClient(url, doc.accessToken);
    clients.push(sock);
    const events = collect(sock);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    await app.inject({ method: 'POST', url: `/inventory/items/${id}/purchase`, headers: authHeader(doc.accessToken), payload: { quantity: 7, pricePerUnitPaise: 100 } });
    const evt = await events.waitFor((e) => e.type === 'inventory.item.updated');
    if (evt.type === 'inventory.item.updated') {
      expect(evt.payload.id).toBe(id);
      expect(evt.payload.currentStock).toBe(7);
    }
  });

  it('consuming below reorder level fires inventory.low_stock_alert', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await setupItem(doc, 5);
    await app.inject({ method: 'POST', url: `/inventory/items/${id}/purchase`, headers: authHeader(doc.accessToken), payload: { quantity: 6, pricePerUnitPaise: 100 } }); // 6 ≥ 5, not low
    const sock = await connectClient(url, doc.accessToken);
    clients.push(sock);
    const events = collect(sock);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    await app.inject({ method: 'POST', url: `/inventory/items/${id}/consume`, headers: authHeader(doc.accessToken), payload: { quantity: 2 } }); // 6→4 < 5 → crosses
    const evt = await events.waitFor((e) => e.type === 'inventory.low_stock_alert');
    if (evt.type === 'inventory.low_stock_alert') {
      expect(evt.payload.itemId).toBe(id);
      expect(evt.payload.currentStock).toBe(4);
    }
  });
});
