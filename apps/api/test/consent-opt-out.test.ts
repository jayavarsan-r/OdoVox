import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';

describe('WhatsApp consent — opt-out', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('opting out after opting in blocks sending', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/whatsapp-consent/opt-in`,
      headers: authHeader(doctor.accessToken),
      payload: { method: 'verbal' },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/whatsapp-consent/opt-out`,
      headers: authHeader(doctor.accessToken),
      payload: { reason: 'patient requested stop' },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.status).toBe('OPTED_OUT');
    expect(data.optedOutReason).toBe('patient requested stop');
    expect(data.canSend).toBe(false);
  });

  it('can opt out a patient who was never asked', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const res = await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/whatsapp-consent/opt-out`,
      headers: authHeader(doctor.accessToken),
      payload: {},
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('OPTED_OUT');
  });
});
