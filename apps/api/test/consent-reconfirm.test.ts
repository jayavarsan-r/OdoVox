import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { runWithContext } from '../src/lib/request-context.js';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';

describe('WhatsApp consent — reconfirm', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('reconfirm refreshes lastReconfirmedAt and re-enables sending after expiry', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    // Seed an expired opt-in (14 months old).
    await runWithContext({ clinicId: doctor.clinicId, userId: doctor.userId }, async () => {
      await app.prisma.patientWhatsAppConsent.create({
        data: {
          clinicId: doctor.clinicId,
          patientId,
          status: 'OPTED_IN',
          optedInAt: new Date(Date.now() - 14 * 30 * 24 * 60 * 60 * 1000),
          optedInMethod: 'verbal',
        },
      });
    });

    const res = await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/whatsapp-consent/reconfirm`,
      headers: authHeader(doctor.accessToken),
      payload: { method: 'written' },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.status).toBe('OPTED_IN');
    expect(data.lastReconfirmedAt).not.toBeNull();
    expect(data.canSend).toBe(true);
  });
});
