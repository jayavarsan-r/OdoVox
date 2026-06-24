import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, joinReceptionist } from './helpers.js';
import { storage } from '../src/lib/storage.js';
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

const INTAKE_NOTE =
  'New patient Akhilesh Guhan, 34 year old male, complains of pain in the upper right tooth. He is diabetic.';

describe('POST /patients/intake/dictate', () => {
  it('transcribes + extracts demographics inline', async () => {
    const doctor = await createDoctorWithClinic(app);
    const storageKey = await putAudio(doctor.clinicId, INTAKE_NOTE);

    const res = await app.inject({
      method: 'POST',
      url: '/patients/intake/dictate',
      headers: authHeader(doctor.accessToken),
      payload: { storageKey },
    });

    expect(res.statusCode).toBe(200);
    const intake = res.json().data.intake;
    expect(intake.name).toMatch(/Akhilesh/);
    expect(intake.age).toBe(34);
    expect(intake.gender).toBe('MALE');
    expect(intake.chiefComplaint).toMatch(/pain/i);
    expect(intake.medicalFlags.join(' ')).toMatch(/diab/i);
  });

  it('does not keep the audio long-term — the object is deleted after transcription', async () => {
    const doctor = await createDoctorWithClinic(app);
    const storageKey = await putAudio(doctor.clinicId, INTAKE_NOTE);
    await app.inject({
      method: 'POST',
      url: '/patients/intake/dictate',
      headers: authHeader(doctor.accessToken),
      payload: { storageKey },
    });
    await expect(storage.getObject(storageKey)).rejects.toThrow();
  });

  it('forbids a receptionist (DOCTOR only)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const storageKey = await putAudio(doctor.clinicId, INTAKE_NOTE);
    const res = await app.inject({
      method: 'POST',
      url: '/patients/intake/dictate',
      headers: authHeader(recp.accessToken),
      payload: { storageKey },
    });
    expect(res.statusCode).toBe(403);
  });
});
