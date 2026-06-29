import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  joinDoctor,
  joinReceptionist,
  seedActivePlan,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('POST /plans/:id/cancel — RBAC', () => {
  it('forbids a doctor who is not the plan’s creator (403)', async () => {
    const owner = await createDoctorWithClinic(app);
    const other = await joinDoctor(app, owner.joinCode);
    const patientId = await createPatient(app, owner.clinicId, owner.userId);
    // Plan created by the owner doctor.
    const { planId } = await seedActivePlan(app, owner.clinicId, owner.userId, patientId);

    const res = await app.inject({
      method: 'POST',
      url: `/plans/${planId}/cancel`,
      headers: authHeader(other.accessToken),
      payload: { reason: 'not my plan' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('forbids a receptionist outright (DOCTOR/ADMIN only)', async () => {
    const owner = await createDoctorWithClinic(app);
    const recep = await joinReceptionist(app, owner.joinCode);
    const patientId = await createPatient(app, owner.clinicId, owner.userId);
    const { planId } = await seedActivePlan(app, owner.clinicId, owner.userId, patientId);

    const res = await app.inject({
      method: 'POST',
      url: `/plans/${planId}/cancel`,
      headers: authHeader(recep.accessToken),
      payload: { reason: 'x' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('allows the plan’s own doctor to cancel', async () => {
    const owner = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, owner.clinicId, owner.userId);
    const { planId } = await seedActivePlan(app, owner.clinicId, owner.userId, patientId);
    const res = await app.inject({
      method: 'POST',
      url: `/plans/${planId}/cancel`,
      headers: authHeader(owner.accessToken),
      payload: { reason: 'duplicate plan' },
    });
    expect(res.statusCode).toBe(200);
  });
});
