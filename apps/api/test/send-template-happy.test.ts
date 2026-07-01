import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { sendWhatsAppMessage, runWhatsAppSendJob } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate } from './whatsapp-helpers.js';

describe('WhatsApp send — happy path', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('inserts PENDING + enqueues, then the worker marks it SENT with cost', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'appointment_reminder_24h', {
      body: 'Hi {{1}}, reminder for {{2}} at {{3}}.',
      variables: ['patient_name', 'clinic_name', 'appt_time'],
    });
    await optIn(app, doctor.clinicId, patientId);
    const deps = makeSendDeps(app);

    const outcome = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, () =>
      sendWhatsAppMessage(deps, {
        clinicId: doctor.clinicId,
        patientId,
        templateKey: 'appointment_reminder_24h',
        variables: { 1: 'Meera', 2: 'Smile Dental', 3: '10:30 AM' },
        triggerType: 'MANUAL',
      }),
    );

    expect(outcome.queued).toBe(true);
    expect(outcome.status).toBe('PENDING');
    expect(deps.enqueued).toEqual([outcome.messageId]);

    const pending = await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } });
    expect(pending.body).toBe('Hi Meera, reminder for Smile Dental at 10:30 AM.');
    expect(pending.status).toBe('PENDING');

    await runWhatsAppSendJob({ prisma: app.prisma, provider: deps.provider }, outcome.messageId!);
    const sent = await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } });
    expect(sent.status).toBe('SENT');
    expect(sent.providerMessageId).toMatch(/^mock-/);
    expect(sent.costPaise).toBe(35);
    expect(sent.sentAt).not.toBeNull();
  });
});
