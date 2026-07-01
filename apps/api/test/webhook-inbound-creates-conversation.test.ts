import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { patientPhone, postWhatsAppWebhook } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const rid = () => `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

describe('WhatsApp inbound → conversation', () => {
  it('creates an OPEN conversation, logs the INBOUND message and auto-categorises a reschedule', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const phone = await patientPhone(app, doc.clinicId, patientId);

    const res = await postWhatsAppWebhook(
      app,
      '/webhooks/whatsapp/incoming',
      { messages: [{ from: `+91${phone}`, type: 'text', id: 'wamid.in1', text: { body: "I'd like to reschedule my appointment" } }] },
      { eventId: rid() },
    );
    expect(res.statusCode).toBe(200);
    expect(res.json().data.created).toBe(1);

    const convo = await app.prisma.patientConversation.findUniqueOrThrow({
      where: { clinicId_patientId: { clinicId: doc.clinicId, patientId } },
    });
    expect(convo.status).toBe('OPEN');
    expect(convo.category).toBe('RESCHEDULE_REQUEST');
    expect(convo.unreadCount).toBe(1);
    expect(convo.windowExpiresAt).not.toBeNull();

    const msgs = await app.prisma.whatsAppMessage.findMany({ where: { clinicId: doc.clinicId, patientId, direction: 'INBOUND' } });
    expect(msgs).toHaveLength(1);
    expect(msgs[0]!.body).toContain('reschedule');
  });

  it('a second inbound moves the conversation to IN_PROGRESS and bumps unread', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    const phone = await patientPhone(app, doc.clinicId, patientId);
    const send = (body: string) =>
      postWhatsAppWebhook(app, '/webhooks/whatsapp/incoming', { messages: [{ from: `+91${phone}`, type: 'text', text: { body } }] }, { eventId: rid() });

    await send('Hello, I have a question about my bill');
    await send('Are you open on Sunday?');

    const convo = await runWithContext({ clinicId: doc.clinicId }, async () =>
      app.prisma.patientConversation.findUniqueOrThrow({ where: { clinicId_patientId: { clinicId: doc.clinicId, patientId } } }),
    );
    expect(convo.status).toBe('IN_PROGRESS');
    expect(convo.unreadCount).toBe(2);
  });
});
