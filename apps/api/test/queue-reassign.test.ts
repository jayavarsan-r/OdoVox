import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  createVisit,
  reloadVisit,
  joinDoctor,
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

describe('POST /visits/:id/reassign', () => {
  it('moves a waiting visit from one doctor’s queue to another', async () => {
    const doctorA = await createDoctorWithClinic(app);
    const doctorB = await joinDoctor(app, doctorA.joinCode);
    const recp = await joinReceptionist(app, doctorA.joinCode);
    const patientId = await createPatient(app, doctorA.clinicId, doctorA.userId);
    const visit = await createVisit(app, doctorA.clinicId, { patientId, doctorId: doctorA.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/reassign`,
      headers: authHeader(recp.accessToken),
      payload: { doctorId: doctorB.userId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.assignedDoctorId).toBe(doctorB.userId);

    const reloaded = await reloadVisit(app, doctorA.clinicId, visit.id);
    expect(reloaded?.assignedDoctorId).toBe(doctorB.userId);
    expect(reloaded?.doctorId).toBe(doctorB.userId);
    expect(reloaded?.status).toBe('WAITING');

    // Doctor B now sees the patient in their own queue; doctor A does not.
    const bQueue = await app.inject({ method: 'GET', url: '/queue?doctor=me', headers: authHeader(doctorB.accessToken) });
    expect(bQueue.json().data.visits.some((v: { id: string }) => v.id === visit.id)).toBe(true);
    const aQueue = await app.inject({ method: 'GET', url: '/queue?doctor=me', headers: authHeader(doctorA.accessToken) });
    expect(aQueue.json().data.visits.some((v: { id: string }) => v.id === visit.id)).toBe(false);
  });

  it('rejects reassigning to a non-doctor', async () => {
    const doctorA = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctorA.joinCode);
    const patientId = await createPatient(app, doctorA.clinicId, doctorA.userId);
    const visit = await createVisit(app, doctorA.clinicId, { patientId, doctorId: doctorA.userId, status: 'WAITING' });

    const res = await app.inject({
      method: 'POST',
      url: `/visits/${visit.id}/reassign`,
      headers: authHeader(recp.accessToken),
      payload: { doctorId: recp.userId },
    });
    expect(res.statusCode).toBe(400);
  });
});
