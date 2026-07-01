import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { sendWhatsAppMessage, runWhatsAppSendJob } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate, postWhatsAppWebhook } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const rid = () => `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

describe('WhatsApp status webhook', () => {
  it('advances a SENT message through delivered → read', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    await seedTemplate(app, doc.clinicId, 'appointment_reminder_24h');
    await optIn(app, doc.clinicId, patientId);
    const deps = makeSendDeps(app);

    const outcome = await runWithContext({ clinicId: doc.clinicId, userId: doc.userId }, () =>
      sendWhatsAppMessage(deps, { clinicId: doc.clinicId, patientId, templateKey: 'appointment_reminder_24h', variables: { 1: 'Meera', 2: 'Smile Dental' } }),
    );
    await runWhatsAppSendJob({ prisma: app.prisma, provider: deps.provider }, outcome.messageId!);
    const sent = await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } });
    const pmid = sent.providerMessageId!;

    const delivered = await postWhatsAppWebhook(app, '/webhooks/whatsapp/status', { statuses: [{ id: pmid, status: 'delivered', timestamp: Math.floor(Date.now() / 1000) }] }, { eventId: rid() });
    expect(delivered.json().data.updated).toBe(1);
    let row = await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } });
    expect(row.status).toBe('DELIVERED');
    expect(row.deliveredAt).not.toBeNull();

    await postWhatsAppWebhook(app, '/webhooks/whatsapp/status', { statuses: [{ id: pmid, status: 'read', timestamp: Math.floor(Date.now() / 1000) }] }, { eventId: rid() });
    row = await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } });
    expect(row.status).toBe('READ');
    expect(row.readAt).not.toBeNull();
  });

  it('marks a message FAILED with the failure reason', async () => {
    const doc = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    await seedTemplate(app, doc.clinicId, 'appointment_reminder_24h');
    await optIn(app, doc.clinicId, patientId);
    const deps = makeSendDeps(app);
    const outcome = await runWithContext({ clinicId: doc.clinicId, userId: doc.userId }, () =>
      sendWhatsAppMessage(deps, { clinicId: doc.clinicId, patientId, templateKey: 'appointment_reminder_24h', variables: { 1: 'Meera', 2: 'Smile Dental' } }),
    );
    await runWhatsAppSendJob({ prisma: app.prisma, provider: deps.provider }, outcome.messageId!);
    const pmid = (await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } })).providerMessageId!;

    await postWhatsAppWebhook(app, '/webhooks/whatsapp/status', { statuses: [{ id: pmid, status: 'failed', errors: [{ message: 'number not on WhatsApp' }] }] }, { eventId: rid() });
    const row = await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } });
    expect(row.status).toBe('FAILED');
    expect(row.failureReason).toBe('number not on WhatsApp');
  });
});
