import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

/**
 * Phase 9.6 Issue 3: only four fields are truly required to create a patient — name, phone,
 * age, gender. Everything else (blood group above all) must NEVER block creation; the front
 * desk adds those details later.
 */
describe('POST /patients — minimal required fields', () => {
  it('creates a patient with ONLY name + phone + age + gender (no blood group)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const res = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doctor.accessToken),
      payload: { name: 'Priya S', phone: '9876501234', age: 29, gender: 'FEMALE' },
    });
    expect(res.statusCode).toBe(200);
    const p = res.json().data;
    expect(p.name).toBe('Priya S');
    expect(p.bloodGroup).toBeNull();
    expect(p.chiefComplaint).toBeNull();
    expect(p.medicalFlags).toEqual([]);
  });

  it('accepts an explicit null blood group', async () => {
    const doctor = await createDoctorWithClinic(app);
    const res = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doctor.accessToken),
      payload: { name: 'Arun M', phone: '9876501235', age: 41, gender: 'MALE', bloodGroup: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.bloodGroup).toBeNull();
  });

  it('still rejects a missing required field (gender)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const res = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doctor.accessToken),
      payload: { name: 'No Gender', phone: '9876501236', age: 30 },
    });
    expect(res.statusCode).toBe(400);
  });
});
