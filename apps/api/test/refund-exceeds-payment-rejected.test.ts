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

describe('Refund exceeds payment', () => {
  it('rejects a refund larger than the refundable amount with 422', async () => {
    const { doctor, paymentId } = await paidBill(app, 350000, 350000, 'refund-exceed-key-1');
    const res = await app.inject({
      method: 'POST', url: '/refunds', headers: authHeader(doctor.accessToken),
      payload: { paymentId, amountPaise: 400000, reason: 'oops' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('REFUND_EXCEEDS_PAYMENT');
  });
});
