import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient, joinReceptionist } from './helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Bill reminder (Phase 9 notification hook)', () => {
  it('finalizing a bill queues a BILL_FINALIZED reminder', async () => {
    const s = await createDoctorWithClinic(app);
    const recp = await joinReceptionist(app, s.joinCode);
    const patientId = await createPatient(app, s.clinicId, s.userId);
    const created = await app.inject({
      method: 'POST', url: '/bills', headers: authHeader(recp.accessToken),
      payload: { patientId, items: [{ kind: 'PROCEDURE', description: 'RCT', unitPricePaise: 500000 }] },
    });
    const billId = created.json().data.id;
    await app.inject({ method: 'POST', url: `/bills/${billId}/finalize`, headers: authHeader(recp.accessToken) });

    const reminder = await runWithContext({ clinicId: s.clinicId, userId: s.userId }, async () =>
      app.prisma.billReminder.findFirst({ where: { billId } }),
    );
    expect(reminder).toBeTruthy();
    expect(reminder?.type).toBe('BILL_FINALIZED');
    expect(reminder?.status).toBe('PENDING');
  });
});
