import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  joinReceptionist,
} from './helpers.js';
import { storage } from '../src/lib/storage.js';
import { encryptField } from '../src/lib/encryption.js';
import { MOCK_TRANSCRIPT_PREFIX } from '../src/lib/stt/mock-provider.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function putAudio(clinicId: string, transcript: string): Promise<string> {
  const key = `clinics/${clinicId}/dictation/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;
  await storage.putObject(key, Buffer.from(`${MOCK_TRANSCRIPT_PREFIX}${transcript}`), 'audio/webm');
  return key;
}

describe('POST /prescriptions/dictate', () => {
  it('transcribes + extracts the medicines inline', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const storageKey = await putAudio(doctor.clinicId, 'Ibuprofen 400mg BD for 3 days after food.');

    const res = await app.inject({
      method: 'POST',
      url: '/prescriptions/dictate',
      headers: authHeader(doctor.accessToken),
      payload: { patientId, storageKey },
    });

    expect(res.statusCode).toBe(200);
    const { prescription } = res.json().data;
    expect(prescription.prescriptions[0].name).toBe('Ibuprofen');
    expect(prescription.prescriptions[0].frequency).toBe('BD');
  });

  it('surfaces an allergy conflict in safetyWarnings', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId, {
      allergiesEnc: encryptField('Penicillin'),
    });
    const storageKey = await putAudio(doctor.clinicId, 'Amoxicillin 500mg TID for 5 days.');

    const res = await app.inject({
      method: 'POST',
      url: '/prescriptions/dictate',
      headers: authHeader(doctor.accessToken),
      payload: { patientId, storageKey },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().data.safetyWarnings.some((w: string) => w.startsWith('allergy_conflict'))).toBe(true);
  });

  it('forbids a receptionist (DOCTOR only)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const storageKey = await putAudio(doctor.clinicId, 'Ibuprofen 400mg BD for 3 days.');
    const res = await app.inject({
      method: 'POST',
      url: '/prescriptions/dictate',
      headers: authHeader(recp.accessToken),
      payload: { patientId, storageKey },
    });
    expect(res.statusCode).toBe(403);
  });

  it('enforces cross-clinic isolation on the patient (404)', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const clinicB = await createDoctorWithClinic(app);
    const patientA = await createPatient(app, clinicA.clinicId, clinicA.userId);
    const storageKey = await putAudio(clinicB.clinicId, 'Ibuprofen 400mg BD for 3 days.');
    const res = await app.inject({
      method: 'POST',
      url: '/prescriptions/dictate',
      headers: authHeader(clinicB.accessToken),
      payload: { patientId: patientA, storageKey },
    });
    expect(res.statusCode).toBe(404);
  });
});
