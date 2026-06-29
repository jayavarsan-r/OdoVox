import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, seedActivePlan } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('plan endpoints — cross-clinic isolation', () => {
  it('clinic B cannot read, cancel, or PDF clinic A’s plan (404)', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const clinicB = await createDoctorWithClinic(app);
    const patientA = await createPatient(app, clinicA.clinicId, clinicA.userId);
    const { planId } = await seedActivePlan(app, clinicA.clinicId, clinicA.userId, patientA);

    const detail = await app.inject({ method: 'GET', url: `/plans/${planId}`, headers: authHeader(clinicB.accessToken) });
    expect(detail.statusCode).toBe(404);

    const pdf = await app.inject({ method: 'GET', url: `/plans/${planId}/pdf`, headers: authHeader(clinicB.accessToken) });
    expect(pdf.statusCode).toBe(404);

    const cancel = await app.inject({
      method: 'POST',
      url: `/plans/${planId}/cancel`,
      headers: authHeader(clinicB.accessToken),
      payload: { reason: 'x' },
    });
    expect(cancel.statusCode).toBe(404);

    const complete = await app.inject({ method: 'POST', url: `/plans/${planId}/complete`, headers: authHeader(clinicB.accessToken) });
    expect(complete.statusCode).toBe(404);
  });
});
