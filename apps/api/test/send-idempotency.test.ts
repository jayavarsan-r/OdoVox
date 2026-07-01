import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { sendWhatsAppMessage } from '../src/lib/whatsapp/send.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate } from './whatsapp-helpers.js';

describe('WhatsApp send — idempotency', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('same idempotency key returns the existing message and never double-sends', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'lab_case_ready');
    await optIn(app, doctor.clinicId, patientId);
    const deps = makeSendDeps(app);

    const input = {
      clinicId: doctor.clinicId,
      patientId,
      templateKey: 'lab_case_ready',
      variables: { 1: 'Meera', 2: 'Smile Dental' },
      idempotencyKey: `lab_ready:case-123`,
    };

    const first = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, () => sendWhatsAppMessage(deps, input));
    const second = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, () => sendWhatsAppMessage(deps, input));

    expect(first.messageId).toBe(second.messageId);
    expect(second.deduped).toBe(true);
    expect(deps.enqueued).toEqual([first.messageId]); // enqueued exactly once

    const count = await app.prisma.whatsAppMessage.count({ where: { clinicId: doctor.clinicId, idempotencyKey: 'lab_ready:case-123' } });
    expect(count).toBe(1);
  });
});
