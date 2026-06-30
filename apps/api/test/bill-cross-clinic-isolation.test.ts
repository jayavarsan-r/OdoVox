import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, joinReceptionist } from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Bill cross-clinic isolation', () => {
  it("a clinic cannot read or mutate another clinic's bill", async () => {
    const clinicA = await createDoctorWithClinic(app);
    const recpA = await joinReceptionist(app, clinicA.joinCode);
    const patientId = await createPatient(app, clinicA.clinicId, clinicA.userId);
    const created = await app.inject({
      method: 'POST', url: '/bills', headers: authHeader(recpA.accessToken),
      payload: { patientId, items: [{ kind: 'PROCEDURE', description: 'RCT', unitPricePaise: 500000 }] },
    });
    const billId = created.json().data.id;

    const clinicB = await createDoctorWithClinic(app);
    const get = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(clinicB.accessToken) });
    expect(get.statusCode).toBe(404);

    const finalize = await app.inject({
      method: 'POST', url: `/bills/${billId}/finalize`, headers: authHeader(clinicB.accessToken),
    });
    expect(finalize.statusCode).toBe(404);

    const list = await app.inject({ method: 'GET', url: '/bills', headers: authHeader(clinicB.accessToken) });
    expect(list.json().data.items.some((b: { id: string }) => b.id === billId)).toBe(false);
  });
});
