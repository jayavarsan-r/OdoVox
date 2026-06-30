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

describe('Method-specific manual payments', () => {
  it('records UPI manual with txn ref + payer UPI id', async () => {
    const { recp, billId } = await finalizedBill(app, 200000);
    const res = await app.inject({
      method: 'POST', url: '/payments/upi-manual', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 200000, upiId: 'meera@oksbi', upiTxnRef: '418723004511', idempotencyKey: 'm-upi-001' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.method).toBe('UPI_MANUAL');
    expect(res.json().data.upiId).toBe('meera@oksbi');
    expect(res.json().data.upiTxnRef).toBe('418723004511');
  });

  it('records Card manual with last4 + network', async () => {
    const { recp, billId } = await finalizedBill(app, 200000);
    const res = await app.inject({
      method: 'POST', url: '/payments/card-manual', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 200000, cardLast4: '4242', cardNetwork: 'visa', idempotencyKey: 'm-card-1' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.method).toBe('CARD_MANUAL');
    expect(res.json().data.cardLast4).toBe('4242');
    expect(res.json().data.cardNetwork).toBe('visa');
  });

  it('records Bank transfer with txn ref', async () => {
    const { recp, billId } = await finalizedBill(app, 200000);
    const res = await app.inject({
      method: 'POST', url: '/payments/bank-transfer', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 200000, bankTxnRef: 'NEFT-77231', idempotencyKey: 'm-bank-1' },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().data.method).toBe('BANK_TRANSFER');
    expect(res.json().data.bankTxnRef).toBe('NEFT-77231');
  });
});
