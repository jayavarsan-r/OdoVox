import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, joinReceptionist } from './helpers.js';
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

describe('POST /inventory/dictate/adjust (Phase 9.7 W1.2.3, ADMIN only)', () => {
  it('extracts absolute corrected counts + reason for the clinic admin', async () => {
    const admin = await createDoctorWithClinic(app); // clinic creator carries isAdmin
    const key = await putAudio(admin.clinicId, 'Gloves are actually 40 and burs 12 because quarterly stock count');

    const res = await app.inject({
      method: 'POST',
      url: '/inventory/dictate/adjust',
      headers: authHeader(admin.accessToken),
      payload: { storageKey: key },
    });

    expect(res.statusCode).toBe(200);
    const { extraction } = res.json().data;
    expect(extraction.items).toEqual([
      expect.objectContaining({ name: 'gloves', newCount: 40 }),
      expect.objectContaining({ name: 'burs', newCount: 12 }),
    ]);
    expect(extraction.reason).toMatch(/quarterly stock count/);
  });

  it('rejects a non-admin receptionist (403)', async () => {
    const admin = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, admin.joinCode);
    const key = await putAudio(admin.clinicId, 'gloves to 10');

    const res = await app.inject({
      method: 'POST',
      url: '/inventory/dictate/adjust',
      headers: authHeader(recp.accessToken),
      payload: { storageKey: key },
    });
    expect(res.statusCode).toBe(403);
  });
});
