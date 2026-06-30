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

describe('Cash refund (full)', () => {
  it('refunds a cash payment in full: payment REFUNDED, bill balance restored', async () => {
    const { doctor, recp, billId, paymentId } = await paidBill(app, 350000, 350000, 'refund-cash-key-1');
    // Refunds are admin-only → use the founding doctor (isAdmin) token.
    const res = await app.inject({
      method: 'POST', url: '/refunds', headers: authHeader(doctor.accessToken),
      payload: { paymentId, amountPaise: 350000, reason: 'Treatment cancelled' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.status).toBe('SUCCEEDED');
    expect(res.json().data.amountPaise).toBe(350000);
    expect(res.json().data.refundNumber).toMatch(/^RF-/);

    const payment = await app.inject({ method: 'GET', url: `/payments/${paymentId}`, headers: authHeader(recp.accessToken) });
    expect(payment.json().data.status).toBe('REFUNDED');
    expect(payment.json().data.refundedAmountPaise).toBe(350000);

    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.refundedPaise).toBe(350000);
    expect(bill.json().data.balancePaise).toBe(350000);
    expect(bill.json().data.status).toBe('REFUNDED');
  });
});
