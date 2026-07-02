import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { buildTestApp, createDoctorWithClinic, joinReceptionist, authHeader } from './helpers.js';
import { storage } from '../src/lib/storage.js';
import { MOCK_TRANSCRIPT_PREFIX } from '../src/lib/stt/index.js';

/**
 * Phase 9.5 P1.6 (Issue 4): receptionist voice walk-in. The front desk dictates "new patient
 * Ramesh Kumar, 9876543210, complains of tooth pain" and the walk-in sheet prefills from the
 * extraction. POST /queue/walkin/dictate is the receptionist-scoped dictation endpoint (the
 * intake extractor itself was doctor-only until now).
 */

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function putDictationClip(clinicId: string, transcript: string): Promise<string> {
  const key = `clinics/${clinicId}/dictation/${nanoid()}.webm`;
  await storage.putObject(key, Buffer.from(`${MOCK_TRANSCRIPT_PREFIX}${transcript}`), 'audio/webm');
  return key;
}

describe('POST /queue/walkin/dictate', () => {
  it('a RECEPTIONIST dictates a walk-in and gets name + phone + complaint back', async () => {
    const doctor = await createDoctorWithClinic(app);
    const receptionist = await joinReceptionist(app, doctor.joinCode);
    const storageKey = await putDictationClip(
      doctor.clinicId,
      'New patient Ramesh Kumar 9876543210 complains of tooth pain lower right',
    );

    const res = await app.inject({
      method: 'POST',
      url: '/queue/walkin/dictate',
      headers: authHeader(receptionist.accessToken),
      payload: { storageKey },
    });
    expect(res.statusCode).toBe(200);
    const { intake, transcript } = res.json().data as {
      intake: { name: string | null; phone: string | null; chiefComplaint: string | null };
      transcript: string;
    };
    expect(transcript).toContain('Ramesh Kumar');
    expect(intake.name).toBe('Ramesh Kumar');
    expect(intake.phone).toBe('9876543210');
    expect(intake.chiefComplaint).toContain('tooth pain');
  });

  it("rejects a storage key from another clinic's namespace", async () => {
    const doctor = await createDoctorWithClinic(app);
    const receptionist = await joinReceptionist(app, doctor.joinCode);
    const res = await app.inject({
      method: 'POST',
      url: '/queue/walkin/dictate',
      headers: authHeader(receptionist.accessToken),
      payload: { storageKey: 'clinics/other-clinic/dictation/x.webm' },
    });
    expect(res.statusCode).toBe(403);
  });
});
