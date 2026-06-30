import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp } from './helpers.js';
import { razorpayLink, postRazorpayWebhook, uid } from './payment-helpers.js';
import { runWithContext } from '../src/lib/request-context.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

describe('Webhook event dedup', () => {
  it('stores one WebhookEvent per event id; a repeat is a no-op', async () => {
    const { doctor, linkRes } = await razorpayLink(app, 250000, 250000, 'rzp-dedup-1');
    const linkId = linkRes.json().data.razorpayLinkId;
    const eventId = uid('evt_dedup');
    const ev = { eventId, eventType: 'payment_link.paid' as const, linkId, amount: 250000 };

    await postRazorpayWebhook(app, ev);
    const dup = await postRazorpayWebhook(app, ev);
    expect(dup.json().data.outcome).toBe('duplicate');

    const count = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () =>
      app.prisma.webhookEvent.count({ where: { source: 'razorpay', eventId } }),
    );
    expect(count).toBe(1);
  });
});
