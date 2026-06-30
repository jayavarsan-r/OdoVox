import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, type ClinicSetup } from './helpers.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function makeCase(doc: ClinicSetup): Promise<string> {
  const vendor = await app.inject({
    method: 'POST',
    url: '/lab/vendors',
    headers: authHeader(doc.accessToken),
    payload: { name: 'Lab Co', contactPhone: '9840022222', defaultTurnaroundDays: 7, specialties: [] },
  });
  const patientId = await createPatient(app, doc.clinicId, doc.userId);
  const res = await app.inject({
    method: 'POST',
    url: '/lab/cases',
    headers: authHeader(doc.accessToken),
    payload: { patientId, vendorId: vendor.json().data.id, type: 'CROWN', teeth: [26] },
  });
  return res.json().data.id;
}

describe('Lab case photos', () => {
  it('presigns then attaches a photo and lists it', async () => {
    const doc = await createDoctorWithClinic(app);
    const caseId = await makeCase(doc);

    const presign = await app.inject({
      method: 'POST',
      url: `/lab/cases/${caseId}/photos/presign`,
      headers: authHeader(doc.accessToken),
      payload: { mimeType: 'image/jpeg' },
    });
    expect(presign.statusCode).toBe(200);
    expect(presign.json().data.uploadUrl).toMatch(/^https?:\/\//);
    const storageKey = presign.json().data.storageKey;
    expect(storageKey).toContain(`lab/${caseId}/`);

    const attach = await app.inject({
      method: 'POST',
      url: `/lab/cases/${caseId}/photos`,
      headers: authHeader(doc.accessToken),
      payload: { storageKey, mimeType: 'image/jpeg', sizeBytes: 12345 },
    });
    expect(attach.statusCode).toBe(201);
    const photoId = attach.json().data.id;

    const list = await app.inject({ method: 'GET', url: `/lab/cases/${caseId}/photos`, headers: authHeader(doc.accessToken) });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.items.some((p: { id: string }) => p.id === photoId)).toBe(true);

    // Photo also appears on the case detail.
    const detail = await app.inject({ method: 'GET', url: `/lab/cases/${caseId}`, headers: authHeader(doc.accessToken) });
    expect(detail.json().data.photos.length).toBe(1);
  });

  it('soft-deletes (detaches) a photo', async () => {
    const doc = await createDoctorWithClinic(app);
    const caseId = await makeCase(doc);
    const presign = await app.inject({
      method: 'POST',
      url: `/lab/cases/${caseId}/photos/presign`,
      headers: authHeader(doc.accessToken),
      payload: { mimeType: 'image/png' },
    });
    const attach = await app.inject({
      method: 'POST',
      url: `/lab/cases/${caseId}/photos`,
      headers: authHeader(doc.accessToken),
      payload: { storageKey: presign.json().data.storageKey, mimeType: 'image/png', sizeBytes: 999 },
    });
    const photoId = attach.json().data.id;

    const del = await app.inject({
      method: 'DELETE',
      url: `/lab/cases/photos/${photoId}`,
      headers: authHeader(doc.accessToken),
    });
    expect(del.statusCode).toBe(200);

    const list = await app.inject({ method: 'GET', url: `/lab/cases/${caseId}/photos`, headers: authHeader(doc.accessToken) });
    expect(list.json().data.items.some((p: { id: string }) => p.id === photoId)).toBe(false);
  });
});
