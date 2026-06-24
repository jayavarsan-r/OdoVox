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
    payload: { name: 'Tooth Patient', phone: '9876500055', age: 33, gender: 'MALE' },
  });
  patientId = created.json().data.id;
});
afterAll(async () => {
  await cleanup(app, { phones, clinicIds });
  await app.close();
});

describe('ToothRecord', () => {
  it('upserts a tooth status and starts a history', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/patients/${patientId}/teeth/36`,
      headers: authHeader(doc.accessToken),
      payload: { status: 'CARIES', notes: 'Distal caries' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('CARIES');
    expect(res.json().data.history.length).toBe(1);
  });

  it('appends to history on a subsequent change', async () => {
    await app.inject({
      method: 'PUT',
      url: `/patients/${patientId}/teeth/36`,
      headers: authHeader(doc.accessToken),
      payload: { status: 'FILLED' },
    });
    const res = await app.inject({
      method: 'PUT',
      url: `/patients/${patientId}/teeth/36`,
      headers: authHeader(doc.accessToken),
      payload: { status: 'RCT' },
    });
    expect(res.json().data.status).toBe('RCT');
    expect(res.json().data.history.length).toBe(3);
  });

  it('lists tooth records for a patient', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/teeth`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.some((t: { toothNumber: number }) => t.toothNumber === 36)).toBe(true);
  });

  it('writes a TOOTH_UPDATED audit entry', async () => {
    const before = await app.prisma.auditLog.count({ where: { action: 'TOOTH_UPDATED' } });
    await app.inject({
      method: 'PUT',
      url: `/patients/${patientId}/teeth/11`,
      headers: authHeader(doc.accessToken),
      payload: { status: 'CROWN' },
    });
    const after = await app.prisma.auditLog.count({ where: { action: 'TOOTH_UPDATED' } });
    expect(after).toBeGreaterThan(before);
  });
});
