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

describe('POST /visits/:id/priority', () => {
  it('reorders the waiting queue by priority (higher first)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const pa = await createPatient(app, doctor.clinicId, doctor.userId);
    const pb = await createPatient(app, doctor.clinicId, doctor.userId);
    const first = await createVisit(app, doctor.clinicId, { patientId: pa, doctorId: doctor.userId, status: 'WAITING' });
    const second = await createVisit(app, doctor.clinicId, { patientId: pb, doctorId: doctor.userId, status: 'WAITING' });

    // Bump the second patient's priority above the first.
    const res = await app.inject({
      method: 'POST',
      url: `/visits/${second.id}/priority`,
      headers: authHeader(recp.accessToken),
      payload: { priority: 10 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.priority).toBe(10);

    const queue = await app.inject({ method: 'GET', url: '/queue?doctor=all', headers: authHeader(recp.accessToken) });
    const waiting = queue.json().data.visits.filter((v: { status: string }) => v.status === 'WAITING');
    const idxSecond = waiting.findIndex((v: { id: string }) => v.id === second.id);
    const idxFirst = waiting.findIndex((v: { id: string }) => v.id === first.id);
    expect(idxSecond).toBeLessThan(idxFirst); // bumped patient now sorts ahead

    const ev = await findQueueEvent(app, doctor.clinicId, { visitId: second.id, type: 'PRIORITY_CHANGED' });
    expect(ev).toBeTruthy();
  });
});
