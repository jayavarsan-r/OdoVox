import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic } from './helpers.js';
import { runAsSystem } from '../src/lib/request-context.js';
import { processInboundWebhook } from '../src/lib/whatsapp/webhook-service.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
});
afterAll(async () => {
  await app.close();
});

describe('inbound webhook router — lab vs patient (§2.8)', () => {
  it('a sender matching a LabVendor WhatsApp number lands in LabMessage, never in patient conversations', async () => {
    const s = await createDoctorWithClinic(app);
    const labPhone = `98765${Math.floor(10000 + Math.random() * 89999)}`;
    await app.inject({
      method: 'POST',
      url: '/lab/vendors',
      headers: authHeader(s.accessToken),
      payload: { name: 'Router Lab', contactPhone: labPhone, whatsappPhoneNumbers: [labPhone] },
    });

    const result = await processInboundWebhook(app.prisma, {
      eventId: `evt_router_${Date.now()}`,
      events: [{ fromPhone: `+91${labPhone}`, type: 'text', text: 'any update sir', providerMessageId: `wamid_router_${Date.now()}` }],
      payload: {},
      signature: 'test',
    });
    expect(result.outcome).toBe('processed');

    await runAsSystem(async () => {
      const labMsg = await app.prisma.labMessage.findFirst({ where: { clinicId: s.clinicId, fromPhone: `+91${labPhone}` } });
      expect(labMsg).toBeTruthy();
      expect(labMsg!.direction).toBe('INBOUND');
      expect(labMsg!.resolved).toBe(false); // "any update sir" → tiers 3/4
      const patientMsg = await app.prisma.whatsAppMessage.findFirst({ where: { inboundFromPhone: `+91${labPhone}` } });
      expect(patientMsg).toBeNull(); // lab traffic never pollutes patient conversations
    });
  });
});
