import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp } from './helpers.js';
import { paidBill } from './payment-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Refund RBAC', () => {
  it('a RECEPTIONIST cannot issue a refund (admin only) → 403', async () => {
    const { recp, paymentId } = await paidBill(app, 300000, 300000, 'refund-rbac-key-1');
    const res = await app.inject({
      method: 'POST', url: '/refunds', headers: authHeader(recp.accessToken),
      payload: { paymentId, amountPaise: 100000, reason: 'should be blocked' },
    });
    expect(res.statusCode).toBe(403);
  });
});
