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

// Uses the non-prod mock-trigger endpoint to simulate Razorpay confirming the payment.
const trigger = (token: string, paymentId: string) =>
  app.inject({ method: 'POST', url: `/webhooks/razorpay/mock-trigger/${paymentId}`, headers: authHeader(token) });

describe('Webhook event updates the bill', () => {
  it('a partial link payment moves the bill to PARTIAL', async () => {
    const { recp, billId, paymentId } = await razorpayLink(app, 1000000, 400000, 'rzp-evt-partial-1');
    const res = await trigger(recp.accessToken, paymentId);
    expect(res.json().data.outcome).toBe('processed');
    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.status).toBe('PARTIAL');
    expect(bill.json().data.paidPaise).toBe(400000);
    expect(bill.json().data.balancePaise).toBe(600000);
  });

  it('a full link payment moves the bill to PAID and records the Razorpay fee', async () => {
    const { recp, billId, paymentId } = await razorpayLink(app, 350000, 350000, 'rzp-evt-full-1');
    const res = await trigger(recp.accessToken, paymentId);
    expect(res.json().data.outcome).toBe('processed');
    const bill = await app.inject({ method: 'GET', url: `/bills/${billId}`, headers: authHeader(recp.accessToken) });
    expect(bill.json().data.status).toBe('PAID');
    expect(bill.json().data.balancePaise).toBe(0);
    const payment = bill.json().data.payments.find((p: { id: string }) => p.id === paymentId);
    expect(payment.status).toBe('SUCCEEDED');
    expect(payment.razorpayFee).toBe(7000); // mock 2% of 350000
  });
});
