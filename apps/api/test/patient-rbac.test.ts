import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  cleanup,
  createDoctorWithClinic,
  joinReceptionist,
  type ClinicSetup,
} from './helpers.js';

let app: FastifyInstance;
let doc: ClinicSetup;
let receptionToken: string;
let patientId: string;
const phones: string[] = [];
const clinicIds: string[] = [];

beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
  doc = await createDoctorWithClinic(app);
  phones.push(doc.phone);
  clinicIds.push(doc.clinicId);

  const recept = await joinReceptionist(app, doc.joinCode);
  receptionToken = recept.accessToken;
  phones.push(recept.phone);

  const created = await app.inject({
    method: 'POST',
    url: '/patients',
    headers: authHeader(doc.accessToken),
    payload: { name: 'RBAC Patient', phone: '9876500066', age: 50, gender: 'FEMALE' },
  });
  patientId = created.json().data.id;
});
afterAll(async () => {
  await cleanup(app, { phones, clinicIds });
  await app.close();
});

describe('Patient RBAC', () => {
  it('lets a receptionist read patients', async () => {
    const res = await app.inject({ method: 'GET', url: '/patients', headers: authHeader(receptionToken) });
    expect(res.statusCode).toBe(200);
  });

  it('forbids a receptionist from deleting a patient (403)', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/patients/${patientId}`,
      headers: authHeader(receptionToken),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('FORBIDDEN');
  });

  it('forbids a receptionist from updating a tooth (doctor-only, 403)', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: `/patients/${patientId}/teeth/36`,
      headers: authHeader(receptionToken),
      payload: { status: 'CARIES' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('isolates clinics — clinic B cannot read clinic A patient (404)', async () => {
    const otherDoc = await createDoctorWithClinic(app, { contactPhone: '8000000111' });
    phones.push(otherDoc.phone);
    clinicIds.push(otherDoc.clinicId);
    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}`,
      headers: authHeader(otherDoc.accessToken),
    });
    expect(res.statusCode).toBe(404);
  });
});
