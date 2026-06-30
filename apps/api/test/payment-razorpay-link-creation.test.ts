import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp } from './helpers.js';
import { finalizedBill, razorpayLink } from './payment-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Razorpay payment link creation', () => {
  it('creates a PENDING Razorpay payment with a short URL and link id', async () => {
    const { linkRes } = await razorpayLink(app, 350000, 350000, 'rzp-create-aaa');
    expect(linkRes.statusCode).toBe(201);
    const data = linkRes.json().data;
    expect(data.method).toBe('RAZORPAY');
    expect(data.status).toBe('PENDING');
    expect(data.razorpayLinkId).toMatch(/^plink_mock_/);
    expect(data.shortUrl).toContain('mock-razorpay/link/');
    expect(data.paymentId).toBeTruthy();
  });

  it('rejects a link amount greater than the outstanding balance (422)', async () => {
    const { recp, billId } = await finalizedBill(app, 300000);
    const res = await app.inject({
      method: 'POST', url: '/payments/razorpay/link', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 400000, idempotencyKey: 'rzp-overpay-1' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('PAYMENT_EXCEEDS_BALANCE');
  });
});
