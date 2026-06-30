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

describe('Cash payment — happy path', () => {
  it('records a full cash payment, marks the bill PAID and sets paidInFullAt', async () => {
    const { recp, billId, totalPaise } = await finalizedBill(app, 350000);
    const res = await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: totalPaise, idempotencyKey: 'cash-happy-0001' },
    });
    expect(res.statusCode).toBe(201);
    const payment = res.json().data;
    expect(payment.method).toBe('CASH');
    expect(payment.status).toBe('SUCCEEDED');
    expect(payment.amountPaise).toBe(350000);
    expect(payment.paymentNumber).toMatch(/^PAY-/);

    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.status).toBe('PAID');
    expect(bill.json().data.paidPaise).toBe(350000);
    expect(bill.json().data.balancePaise).toBe(0);
    expect(bill.json().data.paidInFullAt).toBeTruthy();
  });
});
