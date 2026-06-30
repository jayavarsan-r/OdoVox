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

const getBill = (token: string, id: string) =>
  app.inject({ method: 'GET', url: `/bills/${id}`, headers: authHeader(token) });

describe('Bill status transitions via payments', () => {
  it('a partial payment moves FINALIZED → PARTIAL', async () => {
    const { recp, billId } = await finalizedBill(app, 1000000);
    const res = await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 400000, idempotencyKey: 'trans-partial-1' },
    });
    expect(res.statusCode).toBe(201);
    const bill = await getBill(recp.accessToken, billId);
    expect(bill.json().data.status).toBe('PARTIAL');
    expect(bill.json().data.balancePaise).toBe(600000);
    expect(bill.json().data.paidInFullAt).toBeNull();
  });

  it('settling the remainder moves PARTIAL → PAID', async () => {
    const { recp, billId } = await finalizedBill(app, 1000000);
    await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 400000, idempotencyKey: 'trans-paid-a' },
    });
    const res = await app.inject({
      method: 'POST', url: '/payments/upi-manual', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 600000, upiTxnRef: 'UPI-9988', idempotencyKey: 'trans-paid-b' },
    });
    expect(res.statusCode).toBe(201);
    const bill = await getBill(recp.accessToken, billId);
    expect(bill.json().data.status).toBe('PAID');
    expect(bill.json().data.balancePaise).toBe(0);
    expect(bill.json().data.paidInFullAt).toBeTruthy();
  });
});
