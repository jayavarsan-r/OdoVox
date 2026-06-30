import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader, buildTestApp, createDoctorWithClinic, createPatient, createVisit, joinReceptionist, reloadVisit,
} from './helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

async function billedVisit(payPaise: number) {
  const s = await createDoctorWithClinic(app);
  const recp = await joinReceptionist(app, s.joinCode);
  const patientId = await createPatient(app, s.clinicId, s.userId);
  const visit = await createVisit(app, s.clinicId, { patientId, doctorId: s.userId, status: 'CHECKOUT' });
  const created = await app.inject({
    method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
    payload: { patientId, visitId: visit.id, items: [{ kind: 'PROCEDURE', description: 'RCT', unitPricePaise: 500000 }] },
  });
  const billId = created.json().data.id;
  await app.inject({ method: 'POST', url: `/bills/${billId}/finalize`, headers: authHeader(recp.accessToken) });
  if (payPaise > 0) {
    await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: payPaise, idempotencyKey: `co-${visit.id}` },
    });
  }
  return { s, recp, patientId, visitId: visit.id, billId };
}

describe('Checkout completes the visit after the bill is settled', () => {
  it('completes the visit when the bill is fully paid', async () => {
    const { s, recp, visitId, billId } = await billedVisit(500000);
    const res = await app.inject({
      method: 'POST', url: `/visits/${visitId}/complete`, headers: authHeader(recp.accessToken),
      payload: { billId, prescriptionHanded: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('COMPLETED');
    const reloaded = await reloadVisit(app, s.clinicId, visitId);
    expect(reloaded?.status).toBe('COMPLETED');
  });

  it('refuses to complete with an unpaid balance unless acceptBalance is set', async () => {
    const { recp, visitId, billId } = await billedVisit(200000); // ₹2,000 of ₹5,000 paid

    const blocked = await app.inject({
      method: 'POST', url: `/visits/${visitId}/complete`, headers: authHeader(recp.accessToken),
      payload: { billId, prescriptionHanded: true },
    });
    expect(blocked.statusCode).toBe(400);

    const accepted = await app.inject({
      method: 'POST', url: `/visits/${visitId}/complete`, headers: authHeader(recp.accessToken),
      payload: { billId, acceptBalance: true, prescriptionHanded: true },
    });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data.status).toBe('COMPLETED');
  });
});
