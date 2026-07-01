import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { sendWhatsAppMessage, runWhatsAppSendJob } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate } from './whatsapp-helpers.js';

describe('WhatsApp send — retry on provider failure', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('marks the message FAILED and throws so BullMQ retries', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'appointment_reminder_24h');
    await optIn(app, doctor.clinicId, patientId);
    const deps = makeSendDeps(app, { failureRate: 1 });

    const outcome = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, () =>
      sendWhatsAppMessage(deps, {
        clinicId: doctor.clinicId,
        patientId,
        templateKey: 'appointment_reminder_24h',
        variables: { 1: 'Meera', 2: 'Smile Dental' },
      }),
    );

    await expect(runWhatsAppSendJob({ prisma: app.prisma, provider: deps.provider }, outcome.messageId!)).rejects.toThrow();
    const row = await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } });
    expect(row.status).toBe('FAILED');
    expect(row.failedAt).not.toBeNull();
  });
});
