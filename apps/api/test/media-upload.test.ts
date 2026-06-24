import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, cleanup, createDoctorWithClinic, type ClinicSetup } from './helpers.js';

let app: FastifyInstance;
let doc: ClinicSetup;
let patientId: string;
const phones: string[] = [];
const clinicIds: string[] = [];

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
  doc = await createDoctorWithClinic(app);
  phones.push(doc.phone);
  clinicIds.push(doc.clinicId);
  const created = await app.inject({
    method: 'POST',
    url: '/patients',
    headers: authHeader(doc.accessToken),
    payload: { name: 'Media Patient', phone: '9876500022', age: 38, gender: 'FEMALE' },
  });
  patientId = created.json().data.id;
});
afterAll(async () => {
  await cleanup(app, { phones, clinicIds });
  await app.close();
});

describe('Media upload', () => {
  it('presigns an upload URL for an allowed mime type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/media/presign',
      headers: authHeader(doc.accessToken),
      payload: { filename: 'xray.jpg', mimeType: 'image/jpeg', sizeBytes: 200000, patientId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.uploadUrl).toMatch(/^https?:\/\//);
    expect(res.json().data.storageKey).toContain(`patients/${patientId}/`);
  });

  it('rejects a disallowed mime type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/media/presign',
      headers: authHeader(doc.accessToken),
      payload: { filename: 'evil.exe', mimeType: 'application/x-msdownload', sizeBytes: 1000, patientId },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a file over the 15MB cap', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/media/presign',
      headers: authHeader(doc.accessToken),
      payload: { filename: 'huge.png', mimeType: 'image/png', sizeBytes: 16 * 1024 * 1024, patientId },
    });
    expect(res.statusCode).toBe(400);
  });

  it('creates a media row matching the storage key, then yields a signed GET URL', async () => {
    const presign = await app.inject({
      method: 'POST',
      url: '/media/presign',
      headers: authHeader(doc.accessToken),
      payload: { filename: 'photo.png', mimeType: 'image/png', sizeBytes: 50000, patientId },
    });
    const storageKey = presign.json().data.storageKey;
    const create = await app.inject({
      method: 'POST',
      url: '/media',
      headers: authHeader(doc.accessToken),
      payload: { patientId, storageKey, type: 'XRAY', mimeType: 'image/png', sizeBytes: 50000, notes: 'left molar' },
    });
    expect(create.statusCode).toBe(200);
    const id = create.json().data.id;

    const url = await app.inject({ method: 'GET', url: `/media/${id}/url`, headers: authHeader(doc.accessToken) });
    expect(url.statusCode).toBe(200);
    expect(url.json().data.url).toMatch(/^https?:\/\//);
  });

  it('lists and soft-deletes media', async () => {
    const presign = await app.inject({
      method: 'POST',
      url: '/media/presign',
      headers: authHeader(doc.accessToken),
      payload: { filename: 'doc.pdf', mimeType: 'application/pdf', sizeBytes: 1000, patientId },
    });
    const create = await app.inject({
      method: 'POST',
      url: '/media',
      headers: authHeader(doc.accessToken),
      payload: {
        patientId,
        storageKey: presign.json().data.storageKey,
        type: 'DOCUMENT',
        mimeType: 'application/pdf',
        sizeBytes: 1000,
      },
    });
    const id = create.json().data.id;
    const del = await app.inject({ method: 'DELETE', url: `/media/${id}`, headers: authHeader(doc.accessToken) });
    expect(del.statusCode).toBe(200);
    const list = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/media`,
      headers: authHeader(doc.accessToken),
    });
    expect(list.json().data.items.some((m: { id: string }) => m.id === id)).toBe(false);
  });
});
