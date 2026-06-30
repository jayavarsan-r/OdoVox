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

describe('Partial refund', () => {
  it('partially refunds a payment: PARTIAL_REFUND, correct amounts on payment + bill', async () => {
    const { doctor, recp, billId, paymentId } = await paidBill(app, 350000, 350000, 'refund-partial-key-1');
    const res = await app.inject({
      method: 'POST', url: '/refunds', headers: authHeader(doctor.accessToken),
      payload: { paymentId, amountPaise: 100000, reason: 'Procedure revised down' },
    });
    expect(res.statusCode).toBe(201);

    const payment = await app.inject({ method: 'GET', url: `/payments/${paymentId}`, headers: authHeader(recp.accessToken) });
    expect(payment.json().data.status).toBe('PARTIAL_REFUND');
    expect(payment.json().data.refundedAmountPaise).toBe(100000);

    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.refundedPaise).toBe(100000);
    expect(bill.json().data.balancePaise).toBe(100000);
    expect(bill.json().data.status).toBe('PARTIAL');
  });
});
