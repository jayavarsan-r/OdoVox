import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { checkConsent } from '../src/lib/whatsapp/consent.js';
import { buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';

describe('WhatsApp consent — expiry after 12 months', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('blocks send when opt-in is older than the 12-month TTL', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      await app.prisma.patientWhatsAppConsent.create({
        data: {
          clinicId: doctor.clinicId,
          patientId,
          status: 'OPTED_IN',
          optedInAt: new Date(Date.now() - 13 * 30 * 24 * 60 * 60 * 1000),
          optedInMethod: 'verbal',
        },
      });
    });

    const gate = await checkConsent(app.prisma, doctor.clinicId, patientId);
    expect(gate.canSend).toBe(false);
    expect(gate.reason).toBe('EXPIRED');
  });

  it('allows send when opt-in is within the TTL', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      await app.prisma.patientWhatsAppConsent.create({
        data: {
          clinicId: doctor.clinicId,
          patientId,
          status: 'OPTED_IN',
          optedInAt: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000),
          optedInMethod: 'verbal',
        },
      });
    });
    const gate = await checkConsent(app.prisma, doctor.clinicId, patientId);
    expect(gate.canSend).toBe(true);
  });
});
