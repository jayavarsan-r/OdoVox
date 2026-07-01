import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { sendWhatsAppMessage } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, seedTemplate } from './whatsapp-helpers.js';

describe('WhatsApp send — blocked without consent', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('logs BLOCKED_NO_CONSENT and never enqueues when the patient has not opted in', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'appointment_reminder_24h');
    const deps = makeSendDeps(app);

    const outcome = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, () =>
      sendWhatsAppMessage(deps, {
        clinicId: doctor.clinicId,
        patientId,
        templateKey: 'appointment_reminder_24h',
        variables: { 1: 'Meera', 2: 'Smile Dental' },
      }),
    );

    expect(outcome.blocked).toBe(true);
    expect(outcome.status).toBe('BLOCKED_NO_CONSENT');
    expect(outcome.reason).toBe('NOT_ASKED');
    expect(deps.enqueued).toHaveLength(0);

    const row = await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } });
    expect(row.status).toBe('BLOCKED_NO_CONSENT');
    expect(row.failureReason).toBe('NOT_ASKED');
  });
});
