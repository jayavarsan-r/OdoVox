import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
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

describe('illegal queue transitions are rejected with 409 INVALID_TRANSITION', () => {
  it('cannot call-in a visit that is already IN_CHAIR', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'IN_CHAIR' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/call-in`,
      headers: authHeader(doctor.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INVALID_TRANSITION');
  });

  it('cannot complete a WAITING visit (must be CHECKOUT first)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/complete`,
      headers: authHeader(recp.accessToken),
      payload: { prescriptionHanded: false },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('INVALID_TRANSITION');
  });

  it('cannot return a WAITING visit to the queue (only IN_CHAIR can)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/return-to-queue`,
      headers: authHeader(doctor.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(409);
  });
});
