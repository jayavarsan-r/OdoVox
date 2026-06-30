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

describe('Finalized bills lock item edits', () => {
  it('rejects adding an item to a FINALIZED bill with 409', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const created = await app.inject({
      method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
      payload: { patientId, items: [{ kind: 'PROCEDURE', description: 'RCT', unitPricePaise: 500000 }] },
    });
    const id = created.json().data.id;
    await app.inject({ method: 'POST', url: `/bills/${id}/finalize`, headers: authHeader(recp.accessToken) });

    const add = await app.inject({
      method: 'POST', url: `/bills/${id}/items`, headers: authHeader(recp.accessToken),
      payload: { kind: 'MATERIAL', description: 'Gloves', unitPricePaise: 10000 },
    });
    expect(add.statusCode).toBe(409);
    expect(add.json().error.code).toBe('BILL_NOT_DRAFT');
  });
});
