import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, seedConsultation } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('consultation cross-clinic isolation', () => {
  it('a doctor in clinic B cannot read or confirm a consultation from clinic A (404)', async () => {
    const clinicA = await createDoctorWithClinic(app);
    const clinicB = await createDoctorWithClinic(app);
    const { consultationId } = await seedConsultation(app, clinicA.clinicId, clinicA.userId, {});

    const getRes = await app.inject({
      method: 'GET',
      url: `/consultations/${consultationId}`,
      headers: authHeader(clinicB.accessToken),
    });
    expect(getRes.statusCode).toBe(404);

    const confirmRes = await app.inject({
      method: 'POST',
      url: `/consultations/${consultationId}/confirm`,
      headers: authHeader(clinicB.accessToken),
      payload: { structuredData: {}, confirmedWithWarning: false },
    });
    expect(confirmRes.statusCode).toBe(404);

    // And clinic A's own doctor still can read it.
    const ownRes = await app.inject({
      method: 'GET',
      url: `/consultations/${consultationId}`,
      headers: authHeader(clinicA.accessToken),
    });
    expect(ownRes.statusCode).toBe(200);
  });
});
