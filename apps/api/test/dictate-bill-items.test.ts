import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
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

describe('POST /bills/:id/dictate/items (Phase 9.7 W1.2.6)', () => {
  it('extracts line items + discount from a spoken bill', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const bill = await app.inject({
      method: 'POST',
      url: '/bills',
      headers: authHeader(doc.accessToken),
      payload: { patientId },
    });
    const billId = bill.json().data.id as string;

    const key = await putAudio(doc.clinicId, 'X-ray 300 rupees and scaling for 1500, discount 200 for senior citizen');
    const res = await app.inject({
      method: 'POST',
      url: `/bills/${billId}/dictate/items`,
      headers: authHeader(doc.accessToken),
      payload: { storageKey: key },
    });

    expect(res.statusCode).toBe(200);
    const { extraction } = res.json().data;
    expect(extraction.items).toEqual([
      expect.objectContaining({ description: 'X-Ray', quantity: 1, unitPricePaise: 30000 }),
      expect.objectContaining({ description: 'Scaling', quantity: 1, unitPricePaise: 150000 }),
    ]);
    expect(extraction.discountPaise).toBe(20000);
    expect(extraction.discountReason).toMatch(/senior citizen/);
  });

  it('extracted items apply through the existing DRAFT-gated item endpoint', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const bill = await app.inject({
      method: 'POST',
      url: '/bills',
      headers: authHeader(doc.accessToken),
      payload: { patientId },
    });
    const billId = bill.json().data.id as string;

    const key = await putAudio(doc.clinicId, '2 x fluoride application at 500 each');
    const res = await app.inject({
      method: 'POST',
      url: `/bills/${billId}/dictate/items`,
      headers: authHeader(doc.accessToken),
      payload: { storageKey: key },
    });
    const row = res.json().data.extraction.items[0];
    expect(row).toMatchObject({ quantity: 2, unitPricePaise: 50000 });

    const applied = await app.inject({
      method: 'POST',
      url: `/bills/${billId}/items`,
      headers: authHeader(doc.accessToken),
      payload: { kind: 'PROCEDURE', description: row.description, quantity: row.quantity, unitPricePaise: row.unitPricePaise },
    });
    expect(applied.statusCode).toBe(201);
    expect(applied.json().data.totalPaise).toBe(100000);
  });
});
