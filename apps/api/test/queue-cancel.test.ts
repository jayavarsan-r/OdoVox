import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  findQueueEvent,
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

describe('POST /visits/:id/cancel', () => {
  it('cancels a WAITING visit with a reason (receptionist)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/cancel`,
      headers: authHeader(recp.accessToken),
      payload: { reason: 'Patient left' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('CANCELLED');

    const ev = await findQueueEvent(app, doctor.clinicId, { visitId: visit.id, type: 'CANCELLED' });
    expect((ev?.metadata as { reason?: string })?.reason).toBe('Patient left');
  });

  it('requires a reason', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/cancel`,
      headers: authHeader(recp.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('lets the assigned doctor cancel their own IN_CHAIR visit', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'IN_CHAIR' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/cancel`,
      headers: authHeader(doctor.accessToken),
      payload: { reason: 'Emergency' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('CANCELLED');
  });
});
