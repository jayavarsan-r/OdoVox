import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  joinReceptionist,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

/**
 * Phase 9.6 Issue 14: recording clinical findings is a doctor act (regulatory, not UX). The
 * receptionist must never be able to start a consultation — this pins the server-side gate so a
 * UI regression (the card showing up again) can't silently write clinical data.
 */
describe('POST /consultations RBAC — doctor only', () => {
  it('a receptionist gets 403 starting a consultation', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    const res = await app.inject({
      method: 'POST',
      url: '/consultations',
      headers: authHeader(recp.accessToken),
      payload: { patientId },
    });
    expect(res.statusCode).toBe(403);
  });

  it('a doctor can start a consultation (200)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    const res = await app.inject({
      method: 'POST',
      url: '/consultations',
      headers: authHeader(doctor.accessToken),
      payload: { patientId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.consultationId).toBeTruthy();
  });
});
