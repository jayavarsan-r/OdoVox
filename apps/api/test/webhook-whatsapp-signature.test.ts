import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './helpers.js';
import { postWhatsAppWebhook } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const rid = () => `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

describe('WhatsApp webhook signature', () => {
  it('accepts a validly-signed status webhook (200)', async () => {
    const res = await postWhatsAppWebhook(
      app,
      '/webhooks/whatsapp/status',
      { statuses: [{ id: 'nope', status: 'delivered' }] },
      { eventId: rid() },
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().data.received).toBe(true);
  });

  it('rejects an invalid signature with 401', async () => {
    const res = await postWhatsAppWebhook(
      app,
      '/webhooks/whatsapp/incoming',
      { messages: [{ from: '+919876543210', type: 'text', text: { body: 'hi' } }] },
      { eventId: rid(), badSignature: true },
    );
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('INVALID_SIGNATURE');
  });

  it('is idempotent — the same event id is not processed twice', async () => {
    const eventId = rid();
    const payload = { statuses: [{ id: 'nope2', status: 'delivered' }] };
    const first = await postWhatsAppWebhook(app, '/webhooks/whatsapp/status', payload, { eventId });
    const second = await postWhatsAppWebhook(app, '/webhooks/whatsapp/status', payload, { eventId });
    expect(first.json().data.outcome).not.toBe('duplicate');
    expect(second.json().data.outcome).toBe('duplicate');
  });
});
