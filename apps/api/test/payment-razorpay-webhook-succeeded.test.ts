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

describe('Razorpay webhook — payment succeeded', () => {
  it('a signed payment_link.paid marks the payment SUCCEEDED and the bill PAID', async () => {
    const { recp, billId, linkRes } = await razorpayLink(app, 350000, 350000, 'rzp-wh-succ-1');
    const linkId = linkRes.json().data.razorpayLinkId;

    const rzpPaymentId = uid('pay_succ');
    const hook = await postRazorpayWebhook(app, {
      eventId: uid('evt_succ'), eventType: 'payment_link.paid', linkId,
      rzpPaymentId, fee: 7000, amount: 350000,
    });
    expect(hook.statusCode).toBe(200);
    expect(hook.json().data.outcome).toBe('processed');

    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.status).toBe('PAID');
    expect(bill.json().data.paidPaise).toBe(350000);
    const payment = bill.json().data.payments[0];
    expect(payment.status).toBe('SUCCEEDED');
    expect(payment.razorpayPaymentId).toBe(rzpPaymentId);
    expect(payment.razorpayFee).toBe(7000);
  });

  it('rejects a webhook with an invalid signature (401)', async () => {
    const { linkRes } = await razorpayLink(app, 200000, 200000, 'rzp-wh-badsig-1');
    const linkId = linkRes.json().data.razorpayLinkId;
    const hook = await postRazorpayWebhook(app, {
      eventId: uid('evt_badsig'), eventType: 'payment_link.paid', linkId, badSignature: true,
    });
    expect(hook.statusCode).toBe(401);
  });
});
