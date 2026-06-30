import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import type { Socket } from 'socket.io-client';
import { authHeader, buildTestApp } from './helpers.js';
import { collect, connectClient, listenApp } from './socket-helpers.js';
import { finalizedBill } from './payment-helpers.js';

let app: FastifyInstance;
let url: string;
const clients: Socket[] = [];

beforeAll(async () => {
  app = await buildTestApp();
  url = await listenApp(app);
});
afterAll(async () => {
  for (const c of clients) c.close();
  await app.close();
});

describe('Realtime payment broadcast', () => {
  it('a recorded payment broadcasts billing.payment.succeeded to the clinic', async () => {
    const { recp, billId } = await finalizedBill(app, 1000000);
    const sock = await connectClient(url, recp.accessToken);
    clients.push(sock);
    const events = collect(sock);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 400000, idempotencyKey: 'rt-pay-1' },
    });
    const evt = await events.waitFor((e) => e.type === 'billing.payment.succeeded');
    expect(evt.type).toBe('billing.payment.succeeded');
    if (evt.type === 'billing.payment.succeeded') {
      expect(evt.payload.billId).toBe(billId);
      expect(evt.payload.amountPaise).toBe(400000);
      expect(evt.payload.method).toBe('CASH');
    }
  });
});
