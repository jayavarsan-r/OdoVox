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
  reloadVisit,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('POST /visits/:id/checkout — manual checkout', () => {
  it('moves IN_CHAIR → CHECKOUT and stamps checkoutStartedAt', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'IN_CHAIR' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/checkout`,
      headers: authHeader(doctor.accessToken),
      payload: { reason: 'treatment paused' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('CHECKOUT');

    const reloaded = await reloadVisit(app, doctor.clinicId, visit.id);
    expect(reloaded?.status).toBe('CHECKOUT');
    expect(reloaded?.checkoutStartedAt).toBeTruthy();

    const ev = await findQueueEvent(app, doctor.clinicId, { visitId: visit.id, type: 'CHECKOUT_STARTED' });
    expect(ev).toBeTruthy();
  });

  it('a receptionist may also send a visit to checkout', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const visit = await createVisit(app, doctor.clinicId, { patientId, doctorId: doctor.userId, status: 'IN_CHAIR' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/checkout`,
      headers: authHeader(recp.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('CHECKOUT');
  });
});
