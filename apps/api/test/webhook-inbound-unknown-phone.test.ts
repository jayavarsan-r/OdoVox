import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildTestApp, createDoctorWithClinic } from './helpers.js';
import { postWhatsAppWebhook, setBusinessNumber } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const rid = () => `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

describe('WhatsApp inbound — unknown phone', () => {
  it('logs a patient-less message for admin review when the sender is not a known patient', async () => {
    const doc = await createDoctorWithClinic(app);
    const businessNumber = `+9188${Math.floor(1000000 + Math.random() * 8999999)}`;
    await setBusinessNumber(app, doc.clinicId, businessNumber);
    const unknownPhone = '+919000000009';

    const res = await postWhatsAppWebhook(
      app,
      '/webhooks/whatsapp/incoming',
      { to: businessNumber, messages: [{ from: unknownPhone, to: businessNumber, type: 'text', text: { body: 'Is this Smile Dental?' } }] },
      { eventId: rid() },
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().data.created).toBe(1);

    const msg = await app.prisma.whatsAppMessage.findFirst({
      where: { clinicId: doc.clinicId, direction: 'INBOUND', inboundFromPhone: unknownPhone },
    });
    expect(msg).not.toBeNull();
    expect(msg!.patientId).toBeNull();
    expect(msg!.conversationId).toBeNull();
  });
});
