import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, type ClinicSetup } from './helpers.js';
import { storage } from '../src/lib/storage.js';
import { MOCK_TRANSCRIPT_PREFIX } from '../src/lib/stt/mock-provider.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

async function putAudio(clinicId: string, transcript: string): Promise<string> {
  const key = `clinics/${clinicId}/dictation/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
  await storage.putObject(key, Buffer.from(`${MOCK_TRANSCRIPT_PREFIX}${transcript}`), 'audio/webm');
  return key;
}

async function seedItemWithStock(doc: ClinicSetup, name: string, stock: number): Promise<string> {
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
    payload: { categoryId: cat.json().data.id, name, unitOfMeasure: 'piece', reorderLevel: 1 },
  });
  const id = item.json().data.id as string;
  if (stock > 0) {
    await app.inject({
      method: 'POST',
      url: `/inventory/items/${id}/purchase`,
      headers: authHeader(doc.accessToken),
      payload: { quantity: stock, pricePerUnitPaise: 100 },
    });
  }
  return id;
}

describe('POST /inventory/dictate/consume (Phase 9.7 W1.2.2)', () => {
  it('extracts consumed items + procedure and matches them to catalog stock', async () => {
    const doc = await createDoctorWithClinic(app);
    const glovesId = await seedItemWithStock(doc, 'Gloves', 50);
    const key = await putAudio(doc.clinicId, 'Used 5 gloves and 2 carpules for this filling');

    const res = await app.inject({
      method: 'POST',
      url: '/inventory/dictate/consume',
      headers: authHeader(doc.accessToken),
      payload: { storageKey: key },
    });

    expect(res.statusCode).toBe(200);
    const { extraction } = res.json().data;
    expect(extraction.procedureName).toBe('filling');
    expect(extraction.items).toHaveLength(2);
    const gloves = extraction.items.find((i: { name: string }) => i.name === 'gloves');
    expect(gloves.match.itemId).toBe(glovesId);
    expect(gloves.insufficientStock).toBe(false);
    const carpules = extraction.items.find((i: { name: string }) => i.name === 'carpules');
    expect(carpules.match).toBeNull(); // not in catalog → card asks the doctor to pick
  });

  it('flags insufficient stock upfront, and the apply path still 422s', async () => {
    const doc = await createDoctorWithClinic(app);
    const id = await seedItemWithStock(doc, 'Carpules', 1);
    const key = await putAudio(doc.clinicId, 'used 4 carpules');

    const res = await app.inject({
      method: 'POST',
      url: '/inventory/dictate/consume',
      headers: authHeader(doc.accessToken),
      payload: { storageKey: key },
    });
    const row = res.json().data.extraction.items[0];
    expect(row.match.itemId).toBe(id);
    expect(row.insufficientStock).toBe(true);

    // The invariant lives on the movement: consuming past zero is rejected.
    const apply = await app.inject({
      method: 'POST',
      url: `/inventory/items/${id}/consume`,
      headers: authHeader(doc.accessToken),
      payload: { quantity: 4 },
    });
    expect(apply.statusCode).toBe(422);
    expect(apply.json().error.code).toBe('INSUFFICIENT_STOCK');
  });
});
