import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { authHeader, buildTestApp, createDoctorWithClinic, type ClinicSetup } from './helpers.js';
import { createPatient } from './helpers.js';
import { optIn, seedTemplate } from './whatsapp-helpers.js';

let app: FastifyInstance;
beforeAll(async () => {
  app = await buildTestApp();
  await app.ready();
});
afterAll(async () => {
  await app.close();
});

const post = (doc: ClinicSetup, url: string, payload: unknown = {}) =>
  app.inject({ method: 'POST', url, headers: authHeader(doc.accessToken), payload });

describe('Cross-wire: lab case READY → lab_case_ready send', () => {
  it('creates a PENDING lab_case_ready message when a case reaches READY (consented patient)', async () => {
    const doc = await createDoctorWithClinic(app);
    await seedTemplate(app, doc.clinicId, 'lab_case_ready', {
      body: 'Hi {{1}}, your {{2}} is ready at {{3}}.',
      variables: ['patient_name', 'case_type', 'clinic_name'],
    });
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    await optIn(app, doc.clinicId, patientId);

    const vendor = await post(doc, '/lab/vendors', { name: 'Lab Co', contactPhone: '9840011111', defaultTurnaroundDays: 7, specialties: ['crown'] });
    const vendorId = vendor.json().data.id;
    const created = await post(doc, '/lab/cases', { patientId, vendorId, type: 'CROWN', teeth: [26], material: 'Zirconia', shade: 'A2' });
    const caseId = created.json().data.id;

    await post(doc, `/lab/cases/${caseId}/send`);
    const ready = await post(doc, `/lab/cases/${caseId}/receive`);
    expect(ready.statusCode).toBe(200);

    const msg = await app.prisma.whatsAppMessage.findFirst({
      where: { clinicId: doc.clinicId, triggerType: 'LAB_CASE_READY', triggerEntityId: caseId },
    });
    expect(msg).not.toBeNull();
    expect(msg!.templateId).not.toBeNull();
    expect(msg!.body).toContain('crown');
    expect(msg!.idempotencyKey).toBe(`lab_ready:${caseId}`);
  });

  it('does not send when the patient has not consented', async () => {
    const doc = await createDoctorWithClinic(app);
    await seedTemplate(app, doc.clinicId, 'lab_case_ready');
    const patientId = await createPatient(app, doc.clinicId, doc.userId);
    // No opt-in.
    const vendor = await post(doc, '/lab/vendors', { name: 'Lab Co', contactPhone: '9840011112', defaultTurnaroundDays: 7, specialties: ['crown'] });
    const vendorId = vendor.json().data.id;
    const created = await post(doc, '/lab/cases', { patientId, vendorId, type: 'BRIDGE', teeth: [24, 25, 26], material: 'PFM', shade: 'A3' });
    const caseId = created.json().data.id;
    await post(doc, `/lab/cases/${caseId}/send`);
    await post(doc, `/lab/cases/${caseId}/receive`);

    const blocked = await app.prisma.whatsAppMessage.findFirst({
      where: { clinicId: doc.clinicId, triggerEntityId: caseId, status: 'BLOCKED_NO_CONSENT' },
    });
    expect(blocked).not.toBeNull();
  });
});
