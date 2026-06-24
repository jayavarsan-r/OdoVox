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
    payload: { name: 'Plan Patient', phone: '9876500044', age: 45, gender: 'FEMALE' },
  });
  patientId = created.json().data.id;
});
afterAll(async () => {
  await cleanup(app, { phones, clinicIds });
  await app.close();
});

describe('Treatment plans', () => {
  it('creates a plan with nested procedures and computes progress', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/plans`,
      headers: authHeader(doc.accessToken),
      payload: {
        name: 'RCT + Crown 36',
        estimatedCostPaise: 1200000,
        procedures: [
          { name: 'RCT', toothNumbers: [36], totalSittings: 3 },
          { name: 'Crown', toothNumbers: [36], totalSittings: 2 },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    const plan = res.json().data;
    expect(plan.procedures.length).toBe(2);
    expect(plan.progress.totalSittings).toBe(5);
    expect(plan.progress.completedSittings).toBe(0);
    expect(plan.progress.percent).toBe(0);
    expect(plan.status).toBe('ACTIVE');
  });

  it('lists plans for a patient with progress', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/plans`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThan(0);
    expect(res.json().data[0].progress).toBeDefined();
  });

  it('fetches plan detail by id', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/plans`,
      headers: authHeader(doc.accessToken),
      payload: { name: 'Scaling', procedures: [{ name: 'Scaling', totalSittings: 1 }] },
    });
    const id = created.json().data.id;
    const res = await app.inject({ method: 'GET', url: `/plans/${id}`, headers: authHeader(doc.accessToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Scaling');
  });

  it('cancels a plan (status → CANCELLED)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/plans`,
      headers: authHeader(doc.accessToken),
      payload: { name: 'To Cancel', procedures: [] },
    });
    const id = created.json().data.id;
    const res = await app.inject({ method: 'DELETE', url: `/plans/${id}`, headers: authHeader(doc.accessToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('CANCELLED');
  });
});
