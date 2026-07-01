import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { sendWhatsAppMessage } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate, setBudget } from './whatsapp-helpers.js';

describe('WhatsApp send — blocked by budget', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('blocks the send with BLOCKED_BUDGET when the monthly cap is already spent', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'appointment_reminder_24h', { estimatedCostPaise: 35 });
    await optIn(app, doctor.clinicId, patientId);
    // Budget of 20 paise < 35 paise estimated cost ⇒ any send exceeds.
    await setBudget(app, doctor.clinicId, 20);
    const deps = makeSendDeps(app);

    const outcome = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, () =>
      sendWhatsAppMessage(deps, {
        clinicId: doctor.clinicId,
        patientId,
        templateKey: 'appointment_reminder_24h',
        variables: { 1: 'Meera', 2: 'Smile Dental' },
      }),
    );

    expect(outcome.status).toBe('BLOCKED_BUDGET');
    expect(outcome.reason).toBe('BUDGET_EXCEEDED');
    expect(deps.enqueued).toHaveLength(0);
    const row = await app.prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: outcome.messageId! } });
    expect(row.status).toBe('BLOCKED_BUDGET');
  });

  it('allows the send when the budget is null (unlimited)', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'appointment_reminder_24h');
    await optIn(app, doctor.clinicId, patientId);
    await setBudget(app, doctor.clinicId, null);
    const deps = makeSendDeps(app);

    const outcome = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, () =>
      sendWhatsAppMessage(deps, {
        clinicId: doctor.clinicId,
        patientId,
        templateKey: 'appointment_reminder_24h',
        variables: { 1: 'Meera', 2: 'Smile Dental' },
      }),
    );
    expect(outcome.queued).toBe(true);
  });
});
