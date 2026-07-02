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

async function seedItem(doc: ClinicSetup, name: string): Promise<string> {
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
    payload: { categoryId: cat.json().data.id, name, unitOfMeasure: 'box', reorderLevel: 2 },
  });
  return item.json().data.id;
}

const dictate = (doc: ClinicSetup, storageKey: string) =>
  app.inject({
    method: 'POST',
    url: '/inventory/dictate/purchase',
    headers: authHeader(doc.accessToken),
    payload: { storageKey },
  });

describe('POST /inventory/dictate/purchase (Phase 9.7 W1.2.1)', () => {
  it('extracts items, quantities and paise prices from a spoken purchase', async () => {
    const doc = await createDoctorWithClinic(app);
    const key = await putAudio(doc.clinicId, 'Bought 5 boxes of gloves at 200 each and 3 burs at 150 from Meditrade, total 1450');
    const res = await dictate(doc, key);

    expect(res.statusCode).toBe(200);
    const { extraction } = res.json().data;
    expect(extraction.items).toHaveLength(2);
    expect(extraction.items[0]).toMatchObject({ name: 'gloves', quantity: 5, unitPricePaise: 20000 });
    expect(extraction.items[1]).toMatchObject({ name: 'burs', quantity: 3, unitPricePaise: 15000 });
    expect(extraction.items[0].vendorName).toMatch(/meditrade/i);
    expect(extraction.totalCostPaise).toBe(145000);
  });

  it('fuzzy-matches spoken names against the clinic catalog', async () => {
    const doc = await createDoctorWithClinic(app);
    const itemId = await seedItem(doc, 'Latex Gloves');
    const key = await putAudio(doc.clinicId, 'bought 10 gloves at 250');
    const res = await dictate(doc, key);

    const row = res.json().data.extraction.items[0];
    expect(row.match).toBeTruthy();
    expect(row.match.itemId).toBe(itemId);
    expect(row.match.name).toBe('Latex Gloves');
    expect(row.match.score).toBeGreaterThan(0.4);
  });

  it('leaves an unknown item unmatched (card offers "New item — will create?")', async () => {
    const doc = await createDoctorWithClinic(app);
    await seedItem(doc, 'Latex Gloves');
    const key = await putAudio(doc.clinicId, 'bought 2 apex locators at 15000');
    const res = await dictate(doc, key);

    const row = res.json().data.extraction.items[0];
    expect(row.name).toMatch(/apex locator/);
    expect(row.match).toBeNull();
  });
});
