import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp } from './helpers.js';
import { razorpayLink, postRazorpayWebhook, uid } from './payment-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Webhook event — payment failed', () => {
  it('a payment.failed event marks the payment FAILED and leaves the bill unpaid', async () => {
    const { recp, billId, paymentId, linkRes } = await razorpayLink(app, 300000, 300000, 'rzp-fail-1');
    const linkId = linkRes.json().data.razorpayLinkId;

    const hook = await postRazorpayWebhook(app, {
      eventId: uid('evt_fail'), eventType: 'payment.failed', linkId, rzpPaymentId: uid('pay_fail'), amount: 300000,
    });
    expect(hook.statusCode).toBe(200);
    expect(hook.json().data.outcome).toBe('processed');

    const payment = await app.inject({ method: 'GET', url: `/payments/${paymentId}`, headers: authHeader(recp.accessToken) });
    expect(payment.json().data.status).toBe('FAILED');
    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.status).toBe('FINALIZED');
    expect(bill.json().data.paidPaise).toBe(0);
  });
});
