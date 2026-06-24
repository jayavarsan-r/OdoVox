import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  joinReceptionist,
  seedConsultation,
} from './helpers.js';
import { encryptField } from '../src/lib/encryption.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('consultation RBAC + transcript strip', () => {
  it('forbids a receptionist from confirming a consultation (403 + ACCESS_DENIED audit)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const { consultationId } = await seedConsultation(app, doctor.clinicId, doctor.userId, {});

    const res = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/confirm`,
      headers: authHeader(recp.accessToken),
      payload: { structuredData: {}, confirmedWithWarning: false },
    });
    expect(res.statusCode).toBe(403);

    const denied = await app.prisma.auditLog.findFirst({
      where: { action: 'ACCESS_DENIED', clinicId: doctor.clinicId },
      orderBy: { createdAt: 'desc' },
    });
    expect(denied).toBeTruthy();
  });

  it('forbids a receptionist from triggering /process (doctor decides when to process)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const { consultationId } = await seedConsultation(app, doctor.clinicId, doctor.userId, {});

    const res = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/process`,
      headers: authHeader(recp.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(403);
  });

  it('lets a receptionist GET the consultation but NEVER returns the transcript or ciphertext', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const { consultationId } = await seedConsultation(app, doctor.clinicId, doctor.userId, {});
    await app.prisma.consultation.update({
      where: { id: consultationId },
      data: { rawTranscriptEnc: encryptField('RCT on 26 completed, third sitting.') },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/consultations/${consultationId}`,
      headers: authHeader(recp.accessToken),
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.status).toBe('PENDING_REVIEW');
    expect(data).not.toHaveProperty('transcript');
    expect(data).not.toHaveProperty('rawTranscriptEnc');
    expect(JSON.stringify(data)).not.toContain('RCT on 26');
  });

  it('gives the doctor the decrypted transcript on GET', async () => {
    const doctor = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, doctor.clinicId, doctor.userId, {});
    await app.prisma.consultation.update({
      where: { id: consultationId },
      data: { rawTranscriptEnc: encryptField('Extraction of 38 completed.') },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/consultations/${consultationId}`,
      headers: authHeader(doctor.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.transcript).toBe('Extraction of 38 completed.');
  });
});
