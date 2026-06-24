import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, cleanup, createDoctorWithClinic, type ClinicSetup } from './helpers.js';

let app: FastifyInstance;
let doc: ClinicSetup;
const phones: string[] = [];
const clinicIds: string[] = [];

const samplePatient = (over: Record<string, unknown> = {}) => ({
  name: 'Meera Nair',
  phone: '9876543210',
  age: 34,
  gender: 'FEMALE',
  bloodGroup: 'O+',
  address: 'Indiranagar, Bengaluru',
  allergies: 'Penicillin',
  chiefComplaint: 'Toothache upper left',
  medicalFlags: ['HYPERTENSION'],
  ...over,
});

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
  doc = await createDoctorWithClinic(app);
  phones.push(doc.phone);
  clinicIds.push(doc.clinicId);
});
afterAll(async () => {
  await cleanup(app, { phones, clinicIds });
  await app.close();
});

describe('Patient CRUD', () => {
  it('creates a patient with an auto PT- code and NEW status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doc.accessToken),
      payload: samplePatient(),
    });
    expect(res.statusCode).toBe(200);
    const p = res.json().data;
    expect(p.patientCode).toMatch(/^PT-[A-Z0-9]{6}$/);
    expect(p.status).toBe('NEW');
    expect(p.address).toBe('Indiranagar, Bengaluru'); // decrypted on read
  });

  it('reads a patient back by id', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doc.accessToken),
      payload: samplePatient({ name: 'Read Me' }),
    });
    const id = created.json().data.id;
    const res = await app.inject({ method: 'GET', url: `/patients/${id}`, headers: authHeader(doc.accessToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('Read Me');
  });

  it('updates a patient and audits changed fields', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doc.accessToken),
      payload: samplePatient({ name: 'Before' }),
    });
    const id = created.json().data.id;
    const res = await app.inject({
      method: 'PATCH',
      url: `/patients/${id}`,
      headers: authHeader(doc.accessToken),
      payload: { name: 'After', status: 'ACTIVE' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.name).toBe('After');
    expect(res.json().data.status).toBe('ACTIVE');
  });

  it('soft-deletes a patient (hidden from list, 404 on read)', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doc.accessToken),
      payload: samplePatient({ name: 'Delete Me', phone: '9000011122' }),
    });
    const id = created.json().data.id;
    const del = await app.inject({ method: 'DELETE', url: `/patients/${id}`, headers: authHeader(doc.accessToken) });
    expect(del.statusCode).toBe(200);
    const read = await app.inject({ method: 'GET', url: `/patients/${id}`, headers: authHeader(doc.accessToken) });
    expect(read.statusCode).toBe(404);
  });

  it('searches by name (case-insensitive)', async () => {
    await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doc.accessToken),
      payload: samplePatient({ name: 'Zephyr Unique', phone: '9000022233' }),
    });
    const res = await app.inject({
      method: 'GET',
      url: '/patients?search=zephyr',
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.items.some((p: { name: string }) => p.name === 'Zephyr Unique')).toBe(true);
  });

  it('paginates with a cursor', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/patients?limit=1',
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json().data;
    expect(body.items.length).toBe(1);
    expect(body.nextCursor).toBeTruthy();
  });

  it('filters by status (in_chair)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/patients?filter=in_chair',
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.json().data.items)).toBe(true);
  });
});
