import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp } from './helpers.js';
import { finalizedBill } from './payment-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Cash payment — overpayment guard', () => {
  it('rejects a payment exceeding the outstanding balance with 422', async () => {
    const { recp, billId } = await finalizedBill(app, 500000);
    const res = await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 600000, idempotencyKey: 'overpay-0001' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PAYMENT_EXCEEDS_BALANCE');

    // Bill untouched.
    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.paidPaise).toBe(0);
    expect(bill.json().data.status).toBe('FINALIZED');
  });
});
