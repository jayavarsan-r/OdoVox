import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  authHeader,
  buildTestApp,
  createDoctorWithClinic,
  createPatient,
  joinReceptionist,
} from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Cancelling a bill with payments', () => {
  it('refuses to cancel a bill that still holds money (must refund first) with 422', async () => {
    const doctor = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, doctor.joinCode);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const created = await app.inject({
      method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
      payload: { patientId, items: [{ kind: 'PROCEDURE', description: 'RCT', unitPricePaise: 500000 }] },
    });
    const id = created.json().data.id;
    await app.inject({ method: 'POST', url: `/bills/${id}/finalize`, headers: authHeader(recp.accessToken) });

    // Simulate a recorded payment (the /payments route arrives in Stage 3).
    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      await app.prisma.bill.update({
        where: { id },
        data: { paidPaise: 500000, balancePaise: 0, status: 'PAID', paidInFullAt: new Date() },
      });
    });

    const res = await app.inject({
      method: 'POST', url: `/bills/${id}/cancel`, headers: authHeader(recp.accessToken),
      payload: { reason: 'Patient changed mind' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('BILL_HAS_PAYMENTS');
  });
});
