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
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('optimistic locking on queue transitions', () => {
  it('two simultaneous call-ins of the same patient: one wins, the other gets 409 STALE_VERSION', async () => {
    const doctorA = await createDoctorWithClinic(app);
    const doctorB = await joinDoctor(app, doctorA.joinCode);
    await createPatient(app, doctorA.clinicId, doctorA.userId); // warm
    const patientId = await createPatient(app, doctorA.clinicId, doctorA.userId);
    // Leave it unassigned so either doctor can legally claim it.
    const visit = await createVisit(app, doctorA.clinicId, {
      patientId,
      doctorId: doctorA.userId,
      assignedDoctorId: null,
      status: 'WAITING',
    });

    const [r1, r2] = await Promise.all([
      app.inject({ method: 'POST', url: `/visits/${visit.id}/call-in`, headers: authHeader(doctorA.accessToken), payload: {} }),
      app.inject({ method: 'POST', url: `/visits/${visit.id}/call-in`, headers: authHeader(doctorB.accessToken), payload: {} }),
    ]);

    const codes = [r1.statusCode, r2.statusCode].sort();
    expect(codes).toEqual([200, 409]);
    const loser = r1.statusCode === 409 ? r1 : r2;
    expect(loser.json().error.code).toBe('STALE_VERSION');

    const reloaded = await reloadVisit(app, doctorA.clinicId, visit.id);
    expect(reloaded?.status).toBe('IN_CHAIR');
    expect(reloaded?.lifecycleVersion).toBe(1); // exactly one successful transition
  });
});
