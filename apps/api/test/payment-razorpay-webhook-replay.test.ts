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

describe('Razorpay webhook — replay protection', () => {
  it('the same event id delivered twice credits the bill only once', async () => {
    const { recp, billId, linkRes } = await razorpayLink(app, 500000, 500000, 'rzp-replay-1');
    const linkId = linkRes.json().data.razorpayLinkId;
    const event = { eventId: uid('evt_replay'), eventType: 'payment_link.paid' as const, linkId, rzpPaymentId: uid('pay_replay'), fee: 0, amount: 500000 };

    const first = await postRazorpayWebhook(app, event);
    const second = await postRazorpayWebhook(app, event);
    expect(first.json().data.outcome).toBe('processed');
    expect(second.json().data.outcome).toBe('duplicate');

    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.paidPaise).toBe(500000); // credited once
    expect(bill.json().data.status).toBe('PAID');
  });
});
