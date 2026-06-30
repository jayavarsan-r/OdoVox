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

describe('Realtime bill-paid broadcast', () => {
  it('settling a bill in full broadcasts billing.bill.paid', async () => {
    const { recp, billId } = await finalizedBill(app, 350000);
    const sock = await connectClient(url, recp.accessToken);
    clients.push(sock);
    const events = collect(sock);
    await events.waitFor((e) => e.type === 'queue.snapshot');

    await app.inject({
      method: 'POST', url: '/payments/cash', headers: authHeader(recp.accessToken),
      payload: { billId, amountPaise: 350000, idempotencyKey: 'rt-paid-1' },
    });
    const evt = await events.waitFor((e) => e.type === 'billing.bill.paid');
    expect(evt.type).toBe('billing.bill.paid');
    if (evt.type === 'billing.bill.paid') {
      expect(evt.payload.id).toBe(billId);
      expect(evt.payload.status).toBe('PAID');
      expect(evt.payload.balancePaise).toBe(0);
    }
  });
});
