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

describe('Payment idempotency', () => {
  it('a retry with the same idempotency key returns the same payment (no double-charge)', async () => {
    const { recp, billId } = await finalizedBill(app, 1000000);
    const key = 'idem-same-key-1';
    const first = await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 400000, idempotencyKey: key },
    });
    const second = await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 400000, idempotencyKey: key },
    });
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(200); // replay, not a new charge
    expect(second.json().data.id).toBe(first.json().data.id);

    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.paidPaise).toBe(400000); // charged once
  });

  it('different idempotency keys for the same bill create separate payments', async () => {
    const { recp, billId } = await finalizedBill(app, 1000000);
    await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 400000, idempotencyKey: 'idem-diff-a' },
    });
    await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 300000, idempotencyKey: 'idem-diff-b' },
    });
    const list = await app.inject({ method: 'GET', url: `/payments?billId=${billId}`, headers: authHeader(recp.accessToken) });
    expect(list.json().data.items).toHaveLength(2);
    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.paidPaise).toBe(700000);
  });
});
