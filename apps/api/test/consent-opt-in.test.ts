import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, createPatient } from './helpers.js';

describe('WhatsApp consent — opt-in', () => {
  let app: FastifyInstance;
  beforeAll(async () => {
    app = await buildTestApp();
    await app.ready();
  });
  afterAll(async () => {
    await app.close();
  });

  it('records opt-in with method + audit and reports canSend=true', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);

    const res = await app.inject({
      method: 'POST',
      url: `/patients/${patientId}/whatsapp-consent/opt-in`,
      headers: authHeader(doctor.accessToken),
      payload: { method: 'verbal', notes: 'agreed at front desk' },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.status).toBe('OPTED_IN');
    expect(data.optedInMethod).toBe('verbal');
    expect(data.canSend).toBe(true);

    const audit = await app.prisma.auditLog.findFirst({
      where: { clinicId: doctor.clinicId, action: 'WHATSAPP_CONSENT_OPTED_IN', entityId: patientId },
    });
    expect(audit).not.toBeNull();
  });

  it('defaults a never-asked patient to NOT_ASKED with canSend=false', async () => {
    const doctor = await createDoctorWithClinic(app);
    const patientId = await createPatient(app, doctor.clinicId, doctor.userId);
    const res = await app.inject({
      method: 'GET',
      url: `/patients/${patientId}/whatsapp-consent`,
      headers: authHeader(doctor.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().data.status).toBe('NOT_ASKED');
    expect(res.json().data.canSend).toBe(false);
  });
});
