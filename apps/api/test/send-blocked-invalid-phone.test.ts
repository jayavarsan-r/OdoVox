import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { sendWhatsAppMessage } from '../src/lib/whatsapp/send.js';
import { normalizeIndianPhone } from '../src/lib/whatsapp/render.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';
import { makeSendDeps, optIn, seedTemplate } from './whatsapp-helpers.js';

describe('WhatsApp send — phone validation', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('normalises Indian phones to +91 E.164 and rejects invalid ones', () => {
    expect(normalizeIndianPhone('9876543210')).toBe('+919876543210');
    expect(normalizeIndianPhone('+919876543210')).toBe('+919876543210');
    expect(normalizeIndianPhone('09876543210')).toBe('+919876543210');
    expect(normalizeIndianPhone('12345')).toBeNull();
    expect(normalizeIndianPhone('1234567890')).toBeNull(); // starts with 1
  });

  it('blocks the send with INVALID_PHONE for a malformed patient number', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await seedTemplate(app, doctor.clinicId, 'appointment_reminder_24h');
    await optIn(app, doctor.clinicId, patientId);
    // Corrupt the phone to an invalid value.
    await runWithContext({ clinicId: doctor.clinicId }, async () => {
      await app.prisma.patient.update({ where: { id: patientId }, data: { phone: '00000' } });
    });
    const deps = makeSendDeps(app);
    const outcome = await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, () =>
      sendWhatsAppMessage(deps, {
        clinicId: doctor.clinicId,
        patientId,
        templateKey: 'appointment_reminder_24h',
        variables: { 1: 'Meera', 2: 'Smile Dental' },
      }),
    );
    expect(outcome.reason).toBe('INVALID_PHONE');
    expect(deps.enqueued).toHaveLength(0);
  });
});
