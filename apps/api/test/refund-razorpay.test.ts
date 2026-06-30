import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp } from './helpers.js';
import { razorpayLink } from './payment-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Razorpay refund', () => {
  it('refunds a settled Razorpay payment via the gateway, starting PENDING', async () => {
    const { doctor, recp, paymentId } = await razorpayLink(app, 350000, 350000, 'refund-rzp-key-1');
    // Settle the link via the non-prod mock trigger so the payment has a razorpayPaymentId.
    await app.inject({ method: 'POST', url: `/webhooks/razorpay/mock-trigger/${paymentId}`, headers: authHeader(recp.accessToken) });

    const res = await app.inject({
      method: 'POST', url: '/refunds', headers: authHeader(doctor.accessToken),
      payload: { paymentId, amountPaise: 150000, reason: 'Partial adjustment' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.method).toBe('RAZORPAY');
    expect(res.json().data.status).toBe('PENDING'); // confirmed later by the refund webhook
    expect(res.json().data.razorpayRefundId).toMatch(/^rfnd_mock_/);

    const payment = await app.inject({ method: 'GET', url: `/payments/${paymentId}`, headers: authHeader(recp.accessToken) });
    expect(payment.json().data.refundedAmountPaise).toBe(150000);
    expect(payment.json().data.status).toBe('PARTIAL_REFUND');
  });
});
