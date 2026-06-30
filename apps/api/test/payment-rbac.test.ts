import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, joinDoctor } from './helpers.js';
import { finalizedBill } from './payment-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Payment RBAC', () => {
  it('a non-admin DOCTOR cannot record a payment (403)', async () => {
    const { doctor, billId } = await finalizedBill(app, 300000);
    // A second doctor joins (non-admin) — doctors may not record money per the RBAC matrix.
    const doc2 = await joinDoctor(app, doctor.joinCode);
    const res = await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(doc2.accessToken),
      payload: { billId, amountPaise: 300000, idempotencyKey: 'rbac-doc-1' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('a RECEPTIONIST cannot post a non-money adjustment (admin only)', async () => {
    const { recp, billId } = await finalizedBill(app, 300000);
    const res = await app.inject({
      method: 'POST', url: '/payments/adjustment', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: -50000, reason: 'write-off', idempotencyKey: 'rbac-recp-adj-1' },
    });
    expect(res.statusCode).toBe(403);
  });
});
