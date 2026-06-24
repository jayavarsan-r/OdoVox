import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, cleanup, createDoctorWithClinic, type ClinicSetup } from './helpers.js';

let app: FastifyInstance;
let doc: ClinicSetup;
let patientId: string;
const phones: string[] = [];
const clinicIds: string[] = [];

const medicines = [
  { name: 'Amoxicillin 500mg', dosage: '1 tab', frequency: 'TID', durationDays: 5, instructions: 'after food' },
  { name: 'Ibuprofen 400mg', dosage: '1 tab', frequency: 'BD', durationDays: 3 },
];

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
    payload: { name: 'Rx Patient', phone: '9876500033', age: 28, gender: 'MALE' },
  });
  patientId = created.json().data.id;
});
afterAll(async () => {
  await cleanup(app, { phones, clinicIds });
  await app.close();
});

describe('Prescriptions', () => {
  it('creates a prescription with medicines', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/prescriptions`,
      headers: authHeader(doc.accessToken),
      payload: { medicines, instructions: 'Rinse twice daily', reviewAfterDays: 7 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.medicines.length).toBe(2);
  });

  it('generates a PDF and returns a signed URL', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/prescriptions`,
      headers: authHeader(doc.accessToken),
      payload: { medicines },
    });
    const id = created.json().data.id;
    const res = await app.inject({
      method: 'GET',
      url: `/prescriptions/${id}/pdf`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.url).toMatch(/^https?:\/\//);
    // Stored key persisted on the row.
    const rx = await app.prisma.prescription.findUnique({ where: { id } });
    expect(rx?.pdfStorageKey).toBeTruthy();
  });

  it('lists prescriptions for a patient', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/prescriptions`,
      headers: authHeader(doc.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.length).toBeGreaterThan(0);
  });
});
