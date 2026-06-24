import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { decryptField } from '../src/lib/encryption.js';
import { runAsSystem } from '../src/lib/request-context.js';
import { authHeader, buildTestApp, cleanup, createDoctorWithClinic, type ClinicSetup } from './helpers.js';

let app: FastifyInstance;
let doc: ClinicSetup;
const phones: string[] = [];
const clinicIds: string[] = [];

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

describe('Patient PHI encryption at rest', () => {
  it('stores address / medicalHistory / allergies as opaque ciphertext, decryptable to plaintext', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doc.accessToken),
      payload: {
        name: 'PHI Patient',
        phone: '9876500099',
        age: 40,
        gender: 'MALE',
        address: '42 Secret Street, Chennai',
        medicalHistory: 'Type 2 diabetes since 2018',
        allergies: 'Latex, Penicillin',
        medicalFlags: ['DIABETES'],
      },
    });
    const id = res.json().data.id;

    const row = await runAsSystem(async () => {
      return await app.prisma.patient.findFirst({ where: { id } });
    });
    // Ciphertext is opaque (not the plaintext) ...
    expect(row!.addressEnc).toBeTruthy();
    expect(row!.addressEnc).not.toContain('Secret Street');
    expect(row!.medicalHistoryEnc).not.toContain('diabetes');
    expect(row!.allergiesEnc).not.toContain('Latex');
    // ... and round-trips back to plaintext.
    expect(decryptField(row!.addressEnc!)).toBe('42 Secret Street, Chennai');
    expect(decryptField(row!.medicalHistoryEnc!)).toBe('Type 2 diabetes since 2018');
    expect(decryptField(row!.allergiesEnc!)).toBe('Latex, Penicillin');
  });

  it('returns decrypted PHI on an authorized detail read', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doc.accessToken),
      payload: { name: 'Read PHI', phone: '9876500088', age: 22, gender: 'OTHER', allergies: 'Aspirin' },
    });
    const id = res.json().data.id;
    const detail = await app.inject({ method: 'GET', url: `/patients/${id}`, headers: authHeader(doc.accessToken) });
    expect(detail.json().data.allergies).toBe('Aspirin');
  });

  it('never returns *Enc fields to the client', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/patients',
      headers: authHeader(doc.accessToken),
      payload: { name: 'No Enc Leak', phone: '9876500077', age: 30, gender: 'MALE', address: 'X' },
    });
    expect(JSON.stringify(res.json())).not.toContain('addressEnc');
  });
});
